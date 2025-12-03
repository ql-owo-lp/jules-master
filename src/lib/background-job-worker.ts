
import { db } from './db';
import { jobs, sessions, settings } from './db/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { listActivities, sendMessage } from '@/app/sessions/[id]/actions';
import { createSession } from '@/app/sessions/new/actions';
import { differenceInHours } from 'date-fns';
import { Job, AutomationMode, Session } from './types';
import { getSettings, upsertSession } from './session-service';
import { listSources } from '@/app/sessions/actions';

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;

// Sleep helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runBackgroundJobCheck(options = { schedule: true }) {
    if (isRunning) return;
    isRunning = true;

    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        console.warn("BackgroundJobWorker: JULES_API_KEY not set. Skipping check.");
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun();
        }
        return;
    }

    try {
        await processPendingJobs(apiKey);
        await processFailedSessions(apiKey);
    } catch (error) {
        console.error("BackgroundJobWorker: Error during check cycle:", error);
    } finally {
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun();
        }
    }
}

async function processPendingJobs(apiKey: string) {
    console.log("BackgroundJobWorker: Checking for pending jobs...");
    const pendingJobs = await db.select().from(jobs).where(
        sql`${jobs.status} = 'PENDING' OR ${jobs.status} = 'PROCESSING'`
    );

    if (pendingJobs.length === 0) {
        return;
    }

    console.log(`BackgroundJobWorker: Found ${pendingJobs.length} pending/processing jobs.`);

    // We need to fetch sources to resolve repo/branch to Source object if needed.
    // However, createSession needs 'Source' object which contains ID and name.
    // The Job record stores 'repo' (owner/repo) and 'branch'.
    // We can list sources and find the matching one.
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

            // Get existing session IDs (might be partially filled if resumed)
            // The job object from `db.select` parses JSON automatically for sessionIds because of the schema definition?
            // Actually, in `drizzle-orm/sqlite-core`, `mode: 'json'` handles parsing.
            // Let's ensure we have an array.
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
                        newSession = await createSession(
                            job.name,
                            job.prompt,
                            source,
                            job.branch,
                            job.requirePlanApproval ?? false,
                            (job.automationMode as AutomationMode) || 'AUTO_CREATE_PR',
                            apiKey
                        );
                    } catch (e) {
                         console.error(`BackgroundJobWorker: Error creating session ${i+1} for job ${job.id}`, e);
                    }

                    if (!newSession) {
                        retries--;
                        await sleep(1000);
                    }
                }

                if (newSession) {
                    createdSessionIds.push(newSession.id);
                    successCount++;
                    // Upsert session to DB immediately so it's tracked
                    await upsertSession(newSession);

                    // Persist progress immediately
                    await db.update(jobs).set({
                        sessionIds: createdSessionIds // Drizzle handles JSON stringify
                    }).where(eq(jobs.id, job.id));

                } else {
                     console.error(`BackgroundJobWorker: Failed to create session ${i+1} for job ${job.id} after retries.`);
                }

                // Avoid rate limits
                await sleep(500);
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
             // If we fail here, we leave it as PROCESSING or whatever it was, so it can be picked up again?
             // Or we mark it as failed if it's a fatal error?
             // For now, let's mark as FAILED to avoid infinite loops on bad data.
             await db.update(jobs).set({ status: 'FAILED' }).where(eq(jobs.id, job.id));
        }
    }
}

async function processFailedSessions(apiKey: string) {
    console.log("BackgroundJobWorker: Checking for failed sessions to retry...");

    // Find sessions that are FAILED and have retries left (or no retry count yet)
    // We don't have a direct "failed" query easily unless we check local state.
    // We should rely on local DB `sessions` table.

    const failedSessions = await db.select().from(sessions).where(eq(sessions.state, 'FAILED'));

    for (const session of failedSessions) {
        // Check if we should retry
        // We need to determine if the failure was due to rate limit or other.
        // Currently we don't store the error reason in `sessions` table (I added `lastError` but it might be empty if we didn't populate it).
        // If `lastError` is empty, we might have to check activities or assume standard retry.

        // However, the requirement says: "when we are retrying the 'failed job', if the session operation failed due to 'too many requests' error, we will keep retrying it for 50 times. Otherwise... 3 times."
        // This implies we know the error.
        // If we don't have the error, we can't distinguish.
        // Let's look at `createSession` or `sendMessage`. If they fail, they throw or return null.
        // If the session IS ALREADY created but failed later (e.g. during execution), its state becomes FAILED.
        // The error reason is usually in `SessionFailed` activity.

        let errorReason = session.lastError || "";
        if (!errorReason) {
            // Try to find reason from activities
            try {
                const activities = await listActivities(session.id, apiKey);
                const failActivity = activities.find(a => a.sessionFailed);
                if (failActivity?.sessionFailed?.reason) {
                    errorReason = failActivity.sessionFailed.reason;
                    // Update local DB for future ref
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
            // No more retries
            continue;
        }

        console.log(`BackgroundJobWorker: Retrying session ${session.id} (Attempt ${currentRetries + 1}/${maxRetries}). Reason: ${errorReason}`);

        try {
            // Perform retry action.
            // "Retrying the failed job" usually means sending a "retry" message or "continue".
            // The requirement says "The retry and the whole stacked job queue should be continously running...".
            // It also says "when we are retrying... if session operation failed...".
            // Usually we retry by sending a message like "Please try again" or similar, which `auto-retry-worker.ts` does.
            // But `auto-retry-worker` only retries ONCE per failure type (checks if last message was retry message).
            // Here we need to force it up to N times.

            const settingsResult = await getSettings();
            const retryMessage = settingsResult.autoRetryMessage;

            await sendMessage(session.id, retryMessage, apiKey);

            // Increment retry count
            await db.update(sessions).set({
                retryCount: currentRetries + 1,
                lastUpdated: Date.now() // Update timestamp so we don't pick it up immediately if we rely on age
            }).where(eq(sessions.id, session.id));

            console.log(`BackgroundJobWorker: Retry sent for session ${session.id}`);

        } catch (e) {
            console.error(`BackgroundJobWorker: Failed to retry session ${session.id}`, e);
        }

        await sleep(1000);
    }
}


function scheduleNextRun() {
    if (workerTimeout) {
        clearTimeout(workerTimeout);
    }

    // Run every 10 seconds? Or configurable?
    // "continuously running"
    const intervalSeconds = 10;

    workerTimeout = setTimeout(() => {
        runBackgroundJobCheck();
    }, intervalSeconds * 1000);
}

export async function startBackgroundJobWorker() {
    console.log(`BackgroundJobWorker: Starting...`);
    runBackgroundJobCheck();
}
