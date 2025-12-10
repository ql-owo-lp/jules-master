
import { db } from './db';
import { jobs, settings } from './db/schema';
import { eq } from 'drizzle-orm';
import { getSession, sendMessage, listActivities } from '@/app/sessions/[id]/actions';
import { fetchPullRequestStatus } from '@/app/github/actions';
import { differenceInHours } from 'date-fns';
import { shouldInteract } from '@/lib/throttle';

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;

export async function runAutoRetryCheck(options = { schedule: true }) {
    if (isRunning) return;
    isRunning = true;

    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        console.warn("AutoRetryWorker: JULES_API_KEY not set. Skipping check.");
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun();
        }
        return;
    }

    try {
        // 1. Get global settings
        const settingsResult = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
        if (settingsResult.length === 0 || !settingsResult[0].autoRetryEnabled) {
             isRunning = false;
             scheduleNextRun();
             return;
        }

        const retryMessage = settingsResult[0].autoRetryMessage;

        // 2. Get all jobs
        const allJobs = await db.select().from(jobs);

        if (allJobs.length === 0) {
            isRunning = false;
            scheduleNextRun();
            return;
        }

        // 3. Collect all session IDs
        const sessionIds: string[] = [];
        for (const job of allJobs) {
            let ids: string[] = [];

            if (Array.isArray(job.sessionIds)) {
                ids = job.sessionIds;
            } else if (typeof job.sessionIds === 'string') {
                try {
                    ids = JSON.parse(job.sessionIds);
                } catch (e) {
                    console.error(`AutoRetryWorker: Failed to parse sessionIds for job ${job.id}`, e);
                    continue;
                }
            }

            if (ids && Array.isArray(ids)) {
                sessionIds.push(...ids);
            }
        }

        if (sessionIds.length === 0) {
            isRunning = false;
            scheduleNextRun();
            return;
        }

        console.log(`AutoRetryWorker: Checking ${sessionIds.length} sessions for auto-retry...`);

        // 4. Check status of each session
        const CONCURRENCY_LIMIT = 5;
        for (let i = 0; i < sessionIds.length; i += CONCURRENCY_LIMIT) {
            const batch = sessionIds.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(async (sessionId) => {
                try {
                    const session = await getSession(sessionId, apiKey);

// ... (existing imports)

                    // Skip if session updateTime is older than 24 hours to prevent "Zombie" activation
                    if (session?.updateTime) {
                        const updateTime = new Date(session.updateTime);
                        if (differenceInHours(new Date(), updateTime) > 24) {
                            return;
                        }
                    }

                    // Check throttling
                    if (session && settingsResult[0] && !shouldInteract(session, settingsResult[0] as any)) {
                         // console.log(`AutoRetryWorker: Throttling session ${sessionId}.`);
                         return;
                    }

                    // Check if session is FAILED
                    if (session && session.state === 'FAILED') {
                         // Check activities to avoid spamming the same retry message
                         const activities = await listActivities(sessionId, apiKey);
                         const lastUserMessage = activities
                            .filter(a => a.userMessaged)
                            .sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime())[0];

                         if (lastUserMessage?.userMessaged?.userMessage === retryMessage) {
                             console.log(`AutoRetryWorker: Session ${sessionId} already retried with same message. Skipping.`);
                             return;
                         }

                         console.log(`AutoRetryWorker: Retrying session ${sessionId}...`);
                         // Send retry message
                         const result = await sendMessage(sessionId, retryMessage, apiKey, true);
                         // Note: sendMessage doesn't return a simple boolean success, but if it throws it's caught below.
                         // If it returns a result, we assume success.
                         if (result) {
                            console.log(`AutoRetryWorker: Retry message sent to session ${sessionId}.`);
                         }
                    } else if (session && session.state === 'COMPLETED' && session.outputs?.[0]?.pullRequest?.url) {
                         // Check for failing PR checks
                         const prUrl = session.outputs[0].pullRequest.url;
                         try {
                             const prStatus = await fetchPullRequestStatus(prUrl);
                             if (prStatus && prStatus.checks && prStatus.checks.status === 'failure') {
                                 const failingChecks = prStatus.checks.runs
                                     .filter(run => run.conclusion === 'failure' || run.conclusion === 'timed_out')
                                     .map((run, index) => `${index + 1}. ${run.name}`)
                                     .join('\n');

                                 if (failingChecks) {
                                     const message = `the following github action checks are failing:\n${failingChecks}\n\nFix the code and test to make sure these github action checks are passing.`;

                                     // Check if we already sent this message
                                     const activities = await listActivities(sessionId, apiKey);
                                     const lastUserMessage = activities
                                         .filter(a => a.userMessaged)
                                         .sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime())[0];

                                     if (lastUserMessage?.userMessaged?.userMessage === message) {
                                         console.log(`AutoRetryWorker: Session ${sessionId} already notified about PR checks. Skipping.`);
                                         return;
                                     }

                                     console.log(`AutoRetryWorker: Notifying session ${sessionId} about failing checks: ${failingChecks}`);
                                     await sendMessage(sessionId, message, apiKey, true);
                                 }
                             }
                         } catch (err) {
                             console.error(`AutoRetryWorker: Error checking PR status for session ${sessionId}`, err);
                         }
                    }
                } catch (err) {
                    console.error(`AutoRetryWorker: Error processing session ${sessionId}`, err);
                }
            }));
        }

    } catch (error) {
        console.error("AutoRetryWorker: Error during check cycle:", error);
    } finally {
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun();
        }
    }
}

function scheduleNextRun() {
    if (workerTimeout) {
        clearTimeout(workerTimeout);
    }

    db.select().from(settings).where(eq(settings.id, 1)).limit(1)
        .then(settingsResult => {
            let intervalSeconds = 60;
             // Using autoApprovalInterval as a proxy for "worker interval" or default 60
             // Ideally we should have a specific interval setting, but using 60s as default is fine
             if (settingsResult.length > 0) {
                intervalSeconds = settingsResult[0].autoApprovalInterval; // reusing this or should use a default?
             }

            if (intervalSeconds < 10) intervalSeconds = 10;

            workerTimeout = setTimeout(() => {
                runAutoRetryCheck();
            }, intervalSeconds * 1000);
        })
        .catch(e => {
            console.error("AutoRetryWorker: Failed to fetch settings, using default interval.", e);
             workerTimeout = setTimeout(() => {
                runAutoRetryCheck();
            }, 60 * 1000);
        });
}

export async function startAutoRetryWorker() {
    console.log(`AutoRetryWorker: Starting...`);
    runAutoRetryCheck();
}

// For testing purposes only
export function _resetForTest() {
    isRunning = false;
    if (workerTimeout) {
        clearTimeout(workerTimeout);
        workerTimeout = null;
    }
}
