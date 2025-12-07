
import { db } from './db';
import { jobs, settings, sessions } from './db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getSession, sendMessage, listActivities } from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';
import { differenceInHours, differenceInDays } from 'date-fns';

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

export async function runAutoContinueCheck(options = { schedule: true }) {
    if (isRunning) return;
    isRunning = true;

    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        console.warn("AutoContinueWorker: JULES_API_KEY not set. Skipping check.");
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun();
        }
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

        // 2. Get recently started jobs (created within last 3 days)
        const recentJobs = await db.select().from(jobs); // Fetch all and filter in memory to avoid complex date logic in SQL if format is varying

        const now = new Date();
        const filteredJobs = recentJobs.filter(job => {
            const createdAt = new Date(job.createdAt);
            // Check if valid date
            if (isNaN(createdAt.getTime())) return false;
            // Filter out jobs older than 3 days
            return differenceInDays(now, createdAt) <= 3;
        });

        if (filteredJobs.length === 0) {
            isRunning = false;
            scheduleNextRun();
            return;
        }

        // 3. Collect all session IDs
        const sessionIds: string[] = [];
        for (const job of filteredJobs) {
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
        // Batch check local session cache to filter out completed ones
        // We can check local 'sessions' table.
        // If session exists locally and state is 'COMPLETED', we might skip it depending on logic.
        // User requested: "do not check for 'complete' sessions".
        // Current worker logic: check if 'COMPLETED' AND 'NO PR'.
        // So if local cache says 'COMPLETED' AND 'HAS PR', we can skip.

        // Let's filter sessionIds that are definitely done.
        const pendingSessionIds: string[] = [];

        // We can't easily query all sessionIds at once if list is huge, but with 3 days filter it should be small.
        const cachedSessions = await db.select().from(sessions).where(inArray(sessions.id, sessionIds));
        const cachedSessionMap = new Map(cachedSessions.map(s => [s.id, s]));

        for (const sessionId of sessionIds) {
            const cached = cachedSessionMap.get(sessionId);
            if (cached && cached.state === 'COMPLETED') {
                // Check if it has PR in outputs
                let hasPR = false;
                if (cached.outputs && cached.outputs.length > 0) {
                    for (const output of cached.outputs) {
                        if (output.pullRequest?.url) {
                            hasPR = true;
                            break;
                        }
                    }
                }

                if (hasPR) {
                    // Already completed with PR, skip
                    continue;
                }
                // If Completed but no PR, we might need to check again (maybe it failed to update or PR just appeared),
                // but if this worker is the one sending nudges, it needs to fetch to be sure.
                // However, user said "do not check for 'complete' sessions".
                // If we interpret strictly: if cached as complete, don't check.
                // But that defeats the purpose of this worker (handling stuck completions).
                // Let's assume user means "If we know it is 'Done' (Completed + PR), stop checking."
            }
            pendingSessionIds.push(sessionId);
        }

        console.log(`AutoContinueWorker: Checking ${pendingSessionIds.length} sessions for auto-continue...`);

        for (let i = 0; i < pendingSessionIds.length; i += CONCURRENCY_LIMIT) {
            const batch = pendingSessionIds.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(async (sessionId) => {
                try {
                    // Use larger retry window: start 5s, max ~5m (7 retries: 5, 10, 20, 40, 80, 160, 320)
                    const session = await getSession(sessionId, apiKey, { retries: 7, backoff: 5000 });

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
    runAutoContinueCheck();
}

// For testing purposes only
export function _resetForTest() {
    isRunning = false;
    if (workerTimeout) {
        clearTimeout(workerTimeout);
        workerTimeout = null;
    }
}
