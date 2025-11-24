
import { db } from './db';
import { jobs, settings } from './db/schema';
import { eq } from 'drizzle-orm';
import { getSession, listActivities, sendMessage } from '@/app/sessions/[id]/actions';
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
        // 1. Get settings
        const settingsResult = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
        if (settingsResult.length === 0 || !settingsResult[0].autoContinue) {
             isRunning = false;
             scheduleNextRun();
             return;
        }

        const autoContinueMessage = settingsResult[0].autoContinueMessage;

        // 2. Get all jobs
        const allJobs = await db.select().from(jobs);

        if (allJobs.length === 0) {
            isRunning = false;
            scheduleNextRun();
            return;
        }

        // 3. Collect session IDs
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

        console.log(`AutoContinueWorker: Checking ${sessionIds.length} sessions for continuation...`);

        // 4. Check status
        const CONCURRENCY_LIMIT = 5;
        for (let i = 0; i < sessionIds.length; i += CONCURRENCY_LIMIT) {
            const batch = sessionIds.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(async (sessionId) => {
                try {
                    const session = await getSession(sessionId, apiKey);

                    // Check if session is COMPLETED
                    if (session && session.state === 'COMPLETED') {
                        // Check if it has a Pull Request
                        const hasPR = session.outputs?.some(output => output.pullRequest);

                        if (!hasPR) {
                            // Check if we already sent the continue message
                            const activities = await listActivities(sessionId, apiKey);
                            const sortedActivities = activities.sort((a, b) =>
                                new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
                            );

                            const lastUserMessage = sortedActivities.find(a => a.userMessaged);

                            // If the last message was already our continue message, don't spam.
                            if (lastUserMessage && lastUserMessage.userMessaged?.userMessage === autoContinueMessage) {
                                // Unlike Retry, if we said "Continue" and it finished again without PR,
                                // maybe we should say it again?
                                // But if the state is COMPLETED, it means it finished.
                                // If we send a message, it should re-open or trigger new work.
                                // Ideally, we only want to nudge it ONCE per completion without PR.

                                // If there is a SessionCompleted activity NEWER than our message, we might need to nudge again?
                                // Or maybe we should be careful not to create an infinite loop if the agent keeps completing without PR.

                                // Let's adopt a safe strategy:
                                // If the LAST activity is SessionCompleted, AND the PREVIOUS User Message was NOT "Auto Continue", then send it.
                                // If we sent "Auto Continue", and then it completed again (new SessionCompleted), we can try again.

                                const continueMessageIndex = sortedActivities.indexOf(lastUserMessage);
                                const laterCompletion = sortedActivities.slice(0, continueMessageIndex).find(a => a.sessionCompleted);

                                if (!laterCompletion) {
                                    // No completion since our last message.
                                    console.log(`AutoContinueWorker: Session ${sessionId} already nudged. Waiting for new completion.`);
                                    return;
                                }
                            }

                            console.log(`AutoContinueWorker: Continuing session ${sessionId}...`);
                            await sendMessage(sessionId, autoContinueMessage, apiKey);
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
