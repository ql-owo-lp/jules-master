
import { db } from './db';
import { jobs, settings } from './db/schema';
import { eq } from 'drizzle-orm';
import { getSession, listActivities, sendMessage } from '@/app/sessions/[id]/actions';
import type { Session, Activity } from '@/lib/types';

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;

async function runAutoRetryCheck() {
    if (isRunning) return;
    isRunning = true;

    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        console.warn("AutoRetryWorker: JULES_API_KEY not set. Skipping check.");
        isRunning = false;
        scheduleNextRun();
        return;
    }

    try {
        // 1. Get settings to check if enabled and get message/interval
        const settingsResult = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
        if (settingsResult.length === 0 || !settingsResult[0].autoRetry) {
             isRunning = false;
             scheduleNextRun();
             return;
        }

        const autoRetryMessage = settingsResult[0].autoRetryMessage;

        // 2. Get all jobs.
        // NOTE: The prompt says "scan Jules jobs whose status is failed".
        // It doesn't explicitly limit to jobs with autoApproval=true, so we scan all jobs.
        // However, to be safe and consistent with "auto approve", we might want to check if we should filter.
        // But the prompt says "toggled in setting menu. On by default." which implies global scope.
        // I'll scan all jobs.
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

        console.log(`AutoRetryWorker: Checking ${sessionIds.length} sessions for failures...`);

        // 4. Check status of each session
        const CONCURRENCY_LIMIT = 5;
        for (let i = 0; i < sessionIds.length; i += CONCURRENCY_LIMIT) {
            const batch = sessionIds.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(async (sessionId) => {
                try {
                    const session = await getSession(sessionId, apiKey);

                    if (session && session.state === 'FAILED') {
                        // Check if we already sent the retry message recently
                        const activities = await listActivities(sessionId, apiKey);

                        // Sort activities by time descending (newest first)
                        // Activity doesn't strictly guarantee order, but createTime should be reliable.
                         const sortedActivities = activities.sort((a, b) =>
                            new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
                        );

                        // If the last user message was our retry message, don't send it again immediately.
                        // We need to allow the agent time to respond or fail again.
                        // If the state is FAILED, it means the agent finished its attempt and failed.
                        // If the last thing in the feed is a user message (our retry), it means the agent hasn't responded yet?
                        // No, if the state is FAILED, the agent has stopped.

                        // We want to retry if the LAST activity was NOT our retry message.
                        // Or more robustly: If the last "UserMessaged" was NOT our retry message.
                        // But if we send a message, it becomes the last activity.
                        // Then the agent runs. It might fail again.
                        // If it fails again, the state becomes FAILED.
                        // And there might be a SessionFailed activity.

                        // So we look for the most recent message from us.
                        const lastUserMessage = sortedActivities.find(a => a.userMessaged);

                        if (lastUserMessage && lastUserMessage.userMessaged?.userMessage === autoRetryMessage) {
                             // We already sent the retry message.
                             // Did the agent try again and fail?
                             // If the agent failed AFTER we sent the message, there should be a SessionFailed activity LATER than our message.
                             const retryMessageIndex = sortedActivities.indexOf(lastUserMessage);
                             const laterFailure = sortedActivities.slice(0, retryMessageIndex).find(a => a.sessionFailed);

                             if (!laterFailure) {
                                 // No failure since our last retry message.
                                 // This implies the session is still in FAILED state from BEFORE our message (or we just sent it and nothing happened yet).
                                 // However, sending a message usually triggers a state change (e.g. to RESUMED or similar, though API docs don't say).
                                 // If the state is still FAILED and we just sent a message, maybe we shouldn't spam.
                                 // But if the agent ran and failed again, there would be a NEW failure activity.

                                 // If there is NO failure activity after our message, it means we sent the message and the agent is either running (unlikely if state is FAILED) or stuck.
                                 // Safest bet: Don't spam. Only retry if we see a failure that is NEWER than our last retry.
                                 console.log(`AutoRetryWorker: Session ${sessionId} already retried. Waiting for new failure.`);
                                 return;
                             }
                        }

                        console.log(`AutoRetryWorker: Retrying session ${sessionId}...`);
                        await sendMessage(sessionId, autoRetryMessage, apiKey);
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
                intervalSeconds = settingsResult[0].autoRetryInterval;
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
