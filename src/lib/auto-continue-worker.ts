
import { db } from './db';
import { jobs, settings } from './db/schema';
import { eq } from 'drizzle-orm';
import { getSession, sendMessage, listActivities } from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';
import { differenceInHours } from 'date-fns';

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;

// Helper to extract PR URL from session outputs
const getPullRequestUrl = (session: Session | null): string | null => {
    if (session?.outputs && session.outputs.length > 0) {
      for (const output of session.outputs) {
        if (output.pullRequest?.url) {
          return output.pullRequest.url;
        }
      }
    }
    return null;
}

export async function runAutoContinueCheck() {
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
        // 1. Get global settings
        const settingsResult = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
        if (settingsResult.length === 0 || !settingsResult[0].autoContinueEnabled) {
             isRunning = false;
             scheduleNextRun();
             return;
        }

        const continueMessage = settingsResult[0].autoContinueMessage;

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
                    console.error(`AutoContinueWorker: Failed to parse sessionIds for job ${job.id}`, e);
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

        // 4. Check status of each session
        const CONCURRENCY_LIMIT = 5;
        for (let i = 0; i < sessionIds.length; i += CONCURRENCY_LIMIT) {
            const batch = sessionIds.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(async (sessionId) => {
                try {
                    const session = await getSession(sessionId, apiKey);

                    // Skip if session updateTime is older than 24 hours to prevent "Zombie" activation
                    if (session?.updateTime) {
                        const updateTime = new Date(session.updateTime);
                        if (differenceInHours(new Date(), updateTime) > 24) {
                            return;
                        }
                    }

                    // Check if session is COMPLETED and has NO PR
                    if (session && session.state === 'COMPLETED') {
                         const prUrl = getPullRequestUrl(session);

                         if (!prUrl) {
                             // Check activities to avoid spamming the same continue message
                             const activities = await listActivities(sessionId, apiKey);
                             const lastUserMessage = activities
                                .filter(a => a.userMessaged)
                                .sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime())[0];

                             if (lastUserMessage?.userMessaged?.userMessage === continueMessage) {
                                 console.log(`AutoContinueWorker: Session ${sessionId} already prompted to continue. Skipping.`);
                                 return;
                             }

                             console.log(`AutoContinueWorker: Session ${sessionId} completed but no PR. Sending continue message...`);
                             const result = await sendMessage(sessionId, continueMessage, apiKey);
                             if (result) {
                                console.log(`AutoContinueWorker: Continue message sent to session ${sessionId}.`);
                             }
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
                intervalSeconds = settingsResult[0].autoApprovalInterval;
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
    await runAutoContinueCheck();
}
