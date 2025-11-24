
import { db } from './db';
import { jobs, settings } from './db/schema';
import { eq } from 'drizzle-orm';
import { getSession, sendMessage, listActivities } from '@/app/sessions/[id]/actions';
import type { Session, Activity } from '@/lib/types';

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;

async function runAutoContinueCheck() {
    if (isRunning) return;
    isRunning = true;

    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        console.warn("AutoContinueWorker: JULES_API_KEY not set. Skipping check.");
        isRunning = false;
        scheduleNextRun();
        return;
    }

    try {
        const settingsResult = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
        if (settingsResult.length === 0 || !settingsResult[0].autoContinue) {
             isRunning = false;
             scheduleNextRun();
             return;
        }

        const continueMessage = settingsResult[0].autoContinueMessage;

        const allJobs = await db.select().from(jobs);

        if (allJobs.length === 0) {
            isRunning = false;
            scheduleNextRun();
            return;
        }

        const sessionIds: string[] = [];
        for (const job of allJobs) {
            let ids: string[] = [];
            if (Array.isArray(job.sessionIds)) {
                ids = job.sessionIds;
            } else if (typeof job.sessionIds === 'string') {
                try {
                    ids = JSON.parse(job.sessionIds);
                } catch (e) {
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

        console.log(`AutoContinueWorker: Checking ${sessionIds.length} sessions for auto-continue...`);

        const CONCURRENCY_LIMIT = 5;
        for (let i = 0; i < sessionIds.length; i += CONCURRENCY_LIMIT) {
            const batch = sessionIds.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(async (sessionId) => {
                try {
                    const session = await getSession(sessionId, apiKey);

                    // Check if completed
                    if (session && session.state === 'COMPLETED') {
                        // Check if it has a PR
                        let hasPR = false;
                        if (session.outputs) {
                             for (const output of session.outputs) {
                                 if (output.pullRequest) {
                                     hasPR = true;
                                     break;
                                 }
                             }
                        }

                        // If COMPLETED and NO PR, we want to prod it.
                        if (!hasPR) {
                             // Check if we already sent the continue message recently to avoid spamming completed sessions
                             const activities = await listActivities(sessionId, apiKey);

                             if (activities && activities.length > 0) {
                                 const lastActivity = activities[0];
                                 if (lastActivity.userMessaged && lastActivity.userMessaged.userMessage === continueMessage) {
                                     // We already told it to continue, and it's still completed (or hasn't processed yet).
                                     // If it is still COMPLETED, it means it didn't transition to IN_PROGRESS.
                                     // Maybe we shouldn't spam it every minute.
                                     // But if we send a message, it should become IN_PROGRESS (QUEUED/PLANNING).
                                     // If it stays COMPLETED, maybe it ignored us?
                                     // For now, let's just avoid double sending if it's the very last thing.
                                     console.log(`AutoContinueWorker: Session ${sessionId} already nudged recently. Skipping.`);
                                     return;
                                 }
                             }

                            console.log(`AutoContinueWorker: Nudging session ${sessionId} to finish work...`);
                            await sendMessage(sessionId, continueMessage, apiKey);
                        }
                    }
                } catch (err) {
                    console.error(`AutoContinueWorker: Error processing session ${sessionId}`, err);
                }
            }));
        }

    } catch (error) {
        console.error("AutoContinueWorker: Error during check cycle:", error);
    } finally {
        isRunning = false;
        scheduleNextRun();
    }
}

function scheduleNextRun() {
    if (workerTimeout) {
        clearTimeout(workerTimeout);
    }

    db.select().from(settings).where(eq(settings.id, 1)).limit(1)
        .then(settingsResult => {
            let intervalSeconds = 60;
            if (settingsResult.length > 0) {
                intervalSeconds = settingsResult[0].autoContinueInterval;
            }
            if (intervalSeconds < 10) intervalSeconds = 10;

            workerTimeout = setTimeout(() => {
                runAutoContinueCheck();
            }, intervalSeconds * 1000);
        })
        .catch(e => {
            console.error("AutoContinueWorker: Failed to fetch settings, using default interval.", e);
             workerTimeout = setTimeout(() => {
                runAutoContinueCheck();
            }, 60 * 1000);
        });
}

export async function startAutoContinueWorker() {
    console.log(`AutoContinueWorker: Starting...`);
    runAutoContinueCheck();
}
