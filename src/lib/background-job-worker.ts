
import { db } from './db';
import { jobs, sessions, settings, locks } from './db/schema';
import { eq, and, isNotNull, sql, lt } from 'drizzle-orm';
import { listActivities, sendMessage } from '@/app/sessions/[id]/actions';
import { createSession } from '@/app/sessions/new/actions';
import { differenceInHours } from 'date-fns';
import { Job, AutomationMode, Session } from './types';
import { getSettings, upsertSession } from './session-service';
import { listSources } from '@/app/sessions/actions';
import { getAllProfiles } from './profile-service';

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;
let hasStarted = false;

const WORKER_LOCK_ID = 'background_job_worker';

// Sleep helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runBackgroundJobCheck(options = { schedule: true }) {
    if (isRunning) return;
    isRunning = true;

    let nextIntervalSeconds = 60; // Default interval

    try {
        const profiles = await getAllProfiles();
        for (const profile of profiles) {
            const apiKey = profile.julesApiKey || process.env.JULES_API_KEY;

            if (!apiKey) {
                console.warn(`BackgroundJobWorker: API Key not found for profile ${profile.name}. Skipping.`);
                continue;
            }

            // Attempt to acquire lock per profile?
            // The lock should probably be global for the worker, but we iterate profiles inside.
            // Or we could have per-profile locks. Given the scale, global lock for the worker is safer to prevent overlapping runs.
            const hasLock = await acquireLock();
            if (!hasLock) {
                console.log("BackgroundJobWorker: Could not acquire lock, another worker is running.");
                // If we can't get lock, we probably shouldn't continue iterating profiles in this run?
                // Yes, because another worker is doing the job.
                break;
            } else {
                 await processPendingJobs(apiKey, profile.id);
                 await processFailedSessions(apiKey, profile.id);
            }
        }

    } catch (error: any) {
        console.error("BackgroundJobWorker: Error during check cycle:", error);

        // If we hit a rate limit, back off for a longer period
        // Check if error message contains 429 or "Too Many Requests"
        const errorMessage = error?.message || "";
        if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("too many requests")) {
             console.log("BackgroundJobWorker: Rate limit detected. Backing off next run for 5 minutes.");
             nextIntervalSeconds = 300;
        }

    } finally {
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun(nextIntervalSeconds);
        }
    }
}

async function acquireLock(): Promise<boolean> {
    const now = Date.now();
    const LOCK_DURATION_MS = 60 * 1000 * 2; // 2 minutes lock duration

    try {
        // 1. Delete expired locks
        await db.delete(locks).where(
            and(
                eq(locks.id, WORKER_LOCK_ID),
                lt(locks.expiresAt, now)
            )
        );

        // 2. Try to insert new lock
        await db.insert(locks).values({
            id: WORKER_LOCK_ID,
            expiresAt: now + LOCK_DURATION_MS
        });

        return true;
    } catch (e) {
        // If insert fails (likely UNIQUE constraint), we didn't get the lock
        return false;
    }
}

async function processPendingJobs(apiKey: string, profileId: string) {
    console.log(`BackgroundJobWorker: Checking for pending jobs for profile ${profileId}...`);
    const pendingJobs = await db.select().from(jobs).where(
        and(
            eq(jobs.profileId, profileId),
            sql`${jobs.status} = 'PENDING' OR ${jobs.status} = 'PROCESSING'`
        )
    );

    if (pendingJobs.length === 0) {
        return;
    }

    console.log(`BackgroundJobWorker: Found ${pendingJobs.length} pending/processing jobs for profile ${profileId}.`);

    let sourcesList = null;
    try {
        sourcesList = await listSources(apiKey);
    } catch (e) {
        console.error("BackgroundJobWorker: Failed to list sources", e);
        return;
    }

    for (const job of pendingJobs) {
        try {
            console.log(`BackgroundJobWorker: Processing job ${job.id} (${job.name})`);

            // Validate required fields
            if (!job.prompt || !job.sessionCount || !job.repo || !job.branch) {
                console.error(`BackgroundJobWorker: Job ${job.id} is missing required fields.`);
                await db.update(jobs).set({ status: 'FAILED' }).where(eq(jobs.id, job.id));
                continue;
            }

            const [owner, repoName] = job.repo.split('/');
            const source = sourcesList.find(s => s.githubRepo.owner === owner && s.githubRepo.repo === repoName);

            if (!source) {
                console.error(`BackgroundJobWorker: Source not found for job ${job.id} (repo: ${job.repo})`);
                 await db.update(jobs).set({ status: 'FAILED' }).where(eq(jobs.id, job.id));
                continue;
            }

            if (job.status !== 'PROCESSING') {
                await db.update(jobs).set({ status: 'PROCESSING' }).where(eq(jobs.id, job.id));
            }

            const existingSessionIds: string[] = job.sessionIds || [];
            const createdSessionIds: string[] = [...existingSessionIds];
            const sessionCount = job.sessionCount;
            let successCount = existingSessionIds.length;

            console.log(`BackgroundJobWorker: Job ${job.id} has ${successCount}/${sessionCount} sessions created.`);

            // Resume creation from where we left off
            for (let i = successCount; i < sessionCount; i++) {
                let retries = 3;
                let newSession: Session | null = null;

                while (retries > 0 && !newSession) {
                    try {
                        newSession = await createSession({
                            title: job.name,
                            prompt: job.prompt,
                            sourceContext: {
                                source: source.name,
                                githubRepoContext: {
                                    startingBranch: job.branch,
                                }
                            },
                            requirePlanApproval: job.requirePlanApproval ?? false,
                            automationMode: (job.automationMode as AutomationMode) || 'AUTO_CREATE_PR',
                        }, apiKey);
                    } catch (e) {
                         console.error(`BackgroundJobWorker: Error creating session ${i+1} for job ${job.id}`, e);
                    }

                    if (!newSession) {
                        retries--;
                        await sleep(1000);
                    }
                }

                if (newSession) {
                    // Manually inject profileId since createSession doesn't support it yet (it uses active profile but here we are in background worker)
                    // We must ensure the session belongs to the correct profile.
                    // The `createSession` calls `upsertSession` which saves to DB.
                    // If `createSession` infers profile from context (which we are not providing here as a request context),
                    // we need to explicitly set it.
                    // However, `createSession` is an action that calls `jules.googleapis.com`. It returns a session object.
                    // Then `upsertSession` saves it.
                    // `upsertSession` needs to know the profile ID.
                    // We should update `createSession` or `upsertSession` to accept profileId.
                    // For now, let's update it manually after creation.
                    newSession.profileId = profileId;
                    await upsertSession(newSession);

                    createdSessionIds.push(newSession.id);
                    successCount++;

                    // Persist progress immediately
                    await db.update(jobs).set({
                        sessionIds: createdSessionIds // Drizzle handles JSON stringify
                    }).where(eq(jobs.id, job.id));

                } else {
                     console.error(`BackgroundJobWorker: Failed to create session ${i+1} for job ${job.id} after retries.`);
                }

                // Avoid rate limits
                await sleep(2000); // Increased sleep to 2s
            }

            // Update Job final status
            const finalStatus = successCount === sessionCount ? 'COMPLETED' : (successCount > 0 ? 'PARTIAL_SUCCESS' : 'FAILED');

            await db.update(jobs).set({
                status: finalStatus,
                sessionIds: createdSessionIds
            }).where(eq(jobs.id, job.id));

            console.log(`BackgroundJobWorker: Job ${job.id} processed. Status: ${finalStatus}. Created ${successCount}/${sessionCount} sessions.`);

        } catch (e) {
            console.error(`BackgroundJobWorker: Error processing job ${job.id}`, e);
             await db.update(jobs).set({ status: 'FAILED' }).where(eq(jobs.id, job.id));
        }
    }
}

async function processFailedSessions(apiKey: string, profileId: string) {
    console.log(`BackgroundJobWorker: Checking for failed sessions to retry for profile ${profileId}...`);

    const failedSessions = await db.select().from(sessions)
        .where(and(
            eq(sessions.state, 'FAILED'),
            eq(sessions.profileId, profileId)
        ))
        .limit(5);

    for (const session of failedSessions) {
        let errorReason = session.lastError || "";
        if (!errorReason) {
            try {
                const activities = await listActivities(session.id, apiKey);
                const failActivity = activities.find(a => a.sessionFailed);
                if (failActivity?.sessionFailed?.reason) {
                    errorReason = failActivity.sessionFailed.reason;
                    await db.update(sessions).set({ lastError: errorReason }).where(eq(sessions.id, session.id));
                }
            } catch (e) {
                console.error(`BackgroundJobWorker: Failed to list activities for session ${session.id}`, e);
                continue;
            }
        }

        const isRateLimit = errorReason.toLowerCase().includes("too many requests") || errorReason.includes("429");
        const maxRetries = isRateLimit ? 50 : 3;
        const currentRetries = session.retryCount || 0;

        if (currentRetries >= maxRetries) {
            continue;
        }

        console.log(`BackgroundJobWorker: Retrying session ${session.id} (Attempt ${currentRetries + 1}/${maxRetries}). Reason: ${errorReason}`);

        try {
            // Need to pass profileId to getSettings if we want profile-specific settings.
            // But `getSettings` currently infers from active profile which might be wrong in background worker.
            // We should read settings directly for this profile.

            const profileSettings = await db.select().from(settings).where(eq(settings.profileId, profileId)).get();
            // Fallback to defaults if no settings
            const retryMessage = profileSettings?.autoRetryMessage || "You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution";

            await sendMessage(session.id, retryMessage, apiKey);

            await db.update(sessions).set({
                retryCount: currentRetries + 1,
                lastUpdated: Date.now()
            }).where(eq(sessions.id, session.id));

            console.log(`BackgroundJobWorker: Retry sent for session ${session.id}`);

        } catch (e) {
            console.error(`BackgroundJobWorker: Failed to retry session ${session.id}`, e);
        }

        await sleep(2000);
    }
}


function scheduleNextRun(overrideIntervalSeconds?: number) {
    if (workerTimeout) {
        clearTimeout(workerTimeout);
    }

    // Increased to 60 seconds to avoid rate limits
    const intervalSeconds = overrideIntervalSeconds || 60;

    workerTimeout = setTimeout(() => {
        runBackgroundJobCheck();
    }, intervalSeconds * 1000);
}

export async function startBackgroundJobWorker() {
    if (hasStarted) {
        console.log("BackgroundJobWorker: Already started, skipping.");
        return;
    }
    hasStarted = true;
    console.log(`BackgroundJobWorker: Starting...`);
    runBackgroundJobCheck();
}
