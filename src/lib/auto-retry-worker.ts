
import { db } from './db';
import { jobs, profiles } from './db/schema';
import { eq } from 'drizzle-orm';
import { getSession, sendMessage, listActivities } from '@/app/sessions/[id]/actions';
import { differenceInHours } from 'date-fns';

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
        const activeProfile = await db.query.profiles.findFirst({ where: eq(profiles.isActive, true) });
        if (!activeProfile || !activeProfile.autoRetryEnabled) {
             isRunning = false;
             scheduleNextRun();
             return;
        }

        const retryMessage = activeProfile.autoRetryMessage;

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

                    // Skip if session updateTime is older than 24 hours to prevent "Zombie" activation
                    if (session?.updateTime) {
                        const updateTime = new Date(session.updateTime);
                        if (differenceInHours(new Date(), updateTime) > 24) {
                            return;
                        }
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
                         const result = await sendMessage(sessionId, retryMessage, apiKey);
                         // Note: sendMessage doesn't return a simple boolean success, but if it throws it's caught below.
                         // If it returns a result, we assume success.
                         if (result) {
                            console.log(`AutoRetryWorker: Retry message sent to session ${sessionId}.`);
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

    db.query.profiles.findFirst({ where: eq(profiles.isActive, true) })
        .then(activeProfile => {
            let intervalSeconds = 60;
             // Using autoApprovalInterval as a proxy for "worker interval" or default 60
             // Ideally we should have a specific interval setting, but using 60s as default is fine
             if (activeProfile) {
                intervalSeconds = activeProfile.autoApprovalInterval; // reusing this or should use a default?
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
