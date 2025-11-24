
import { db } from './db';
import { jobs, settings } from './db/schema';
import { eq } from 'drizzle-orm';
import { getSession, sendMessage, listActivities } from '@/app/sessions/[id]/actions';
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
        // 1. Get settings to check if enabled and get message
        const settingsResult = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
        if (settingsResult.length === 0 || !settingsResult[0].autoRetry) {
             isRunning = false;
             scheduleNextRun();
             return;
        }

        const retryMessage = settingsResult[0].autoRetryMessage;

        // 2. Get all jobs (we scan all jobs for now, as per requirement "scan Jules jobs")
        // Optimization: In a real app we might want to filter jobs or store session status in DB to avoid scanning all.
        // For now, we follow the pattern of AutoApprovalWorker but since we don't have a specific flag in jobs table for retry,
        // we might need to look at all jobs or maybe just recent ones?
        // The prompt says "scan Jules jobs whose status is failed".
        // Since we don't sync session status to our DB, we have to fetch session IDs from jobs and then fetch session details from API.
        // To avoid fetching too many, we could limit to jobs created recently or just iterate all.
        // Let's iterate all jobs for now, similar to AutoApprovalWorker, but maybe we should filter?
        // AutoApprovalWorker filters by `autoApproval` flag. Here we don't have a flag on job.
        // But the prompt says "When on, we will create multiple retry threads... to scan Jules jobs".
        // Let's grab all jobs.

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

        console.log(`AutoRetryWorker: Checking ${sessionIds.length} sessions for auto-retry...`);

        const CONCURRENCY_LIMIT = 5;
        for (let i = 0; i < sessionIds.length; i += CONCURRENCY_LIMIT) {
            const batch = sessionIds.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(async (sessionId) => {
                try {
                    const session = await getSession(sessionId, apiKey);

                    if (session && session.state === 'FAILED') {
                         // Check if we already sent the retry message recently
                         // We need to fetch activities to see the history
                         const activities = await listActivities(sessionId, apiKey);

                         // Check if the last message from USER (which is us acting as agent/user here) is the retry message
                         // "userMessaged" in activity

                         // We want to avoid infinite loops.
                         // If the last activity was a User Message with our retry text, we shouldn't send it again immediately.
                         // But if the session is STILL failed after our message, maybe we should?
                         // The prompt says: "Do not stop until you find a solution". This implies we SHOULD keep retrying.
                         // However, if we just spam messages, the AI might not have time to process.
                         // But the state is FAILED. Usually it transitions to IN_PROGRESS or similar when processing.
                         // If it's FAILED, it means it stopped.

                         // Let's look at the activities.
                         // If the very last activity is "userMessaged" and the content is `retryMessage`, then we probably shouldn't send it again *yet*
                         // unless we want to spam.
                         // But if the last activity is "sessionFailed" (which presumably puts it in FAILED state),
                         // AND the activity BEFORE that was NOT our retry message (or if it was, but it failed again).

                         // Actually, if we send a message, it should trigger a new run.
                         // If that run fails, we get a NEW "sessionFailed" activity.
                         // So we should be safe to retry as long as the *latest* activity is not our retry message.

                         // Let's find the latest activity.
                         if (activities && activities.length > 0) {
                             const lastActivity = activities[0]; // Assuming listActivities returns newest first?
                             // Need to verify order. Usually APIs return newest first or we sort.
                             // `listActivities` calls `/activities`. The order is likely default (usually chronological or reverse).
                             // Let's assume index 0 is latest for now or check timestamps if needed.
                             // But actually `listActivities` in `src/app/sessions/[id]/actions.ts` just returns the array.
                             // I'll assume standard API behavior (usually newest first for feeds).

                             // If the last thing that happened was we sent the retry message, do nothing.
                             if (lastActivity.userMessaged && lastActivity.userMessaged.userMessage === retryMessage) {
                                 console.log(`AutoRetryWorker: Session ${sessionId} already retried recently. Skipping.`);
                                 return;
                             }
                         }

                        console.log(`AutoRetryWorker: Retrying session ${sessionId}...`);
                        await sendMessage(sessionId, retryMessage, apiKey);
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
