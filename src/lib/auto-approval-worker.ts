
import { db } from './db';
import { jobs, settings } from './db/schema';
import { eq } from 'drizzle-orm';
import { getSession, approvePlan } from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;

async function runAutoApprovalCheck() {
    if (isRunning) return;
    isRunning = true;

    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        console.warn("AutoApprovalWorker: JULES_API_KEY not set. Skipping check.");
        isRunning = false;
        scheduleNextRun();
        return;
    }

    try {
        // 1. Get all jobs marked for auto-approval
        const autoApprovalJobs = await db.select().from(jobs).where(eq(jobs.autoApproval, true));

        if (autoApprovalJobs.length === 0) {
            isRunning = false;
            scheduleNextRun();
            return;
        }

        // 2. Collect all session IDs
        const sessionIds: string[] = [];
        for (const job of autoApprovalJobs) {
            let ids: string[] = [];

            // Handle potential type mismatch or JSON parsing
            if (Array.isArray(job.sessionIds)) {
                ids = job.sessionIds;
            } else if (typeof job.sessionIds === 'string') {
                try {
                    ids = JSON.parse(job.sessionIds);
                } catch (e) {
                    console.error(`AutoApprovalWorker: Failed to parse sessionIds for job ${job.id}`, e);
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

        console.log(`AutoApprovalWorker: Checking ${sessionIds.length} sessions for auto-approval...`);

        // 3. Check status of each session
        // limiting concurrency to 5 requests at a time
        const CONCURRENCY_LIMIT = 5;
        for (let i = 0; i < sessionIds.length; i += CONCURRENCY_LIMIT) {
            const batch = sessionIds.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(async (sessionId) => {
                try {
                    const session = await getSession(sessionId, apiKey);

                    if (session && session.state === 'AWAITING_PLAN_APPROVAL') {
                        console.log(`AutoApprovalWorker: Approving session ${sessionId}...`);
                        const result = await approvePlan(sessionId, apiKey);
                        if (result) {
                            console.log(`AutoApprovalWorker: Session ${sessionId} approved successfully.`);
                        } else {
                            console.error(`AutoApprovalWorker: Failed to approve session ${sessionId}.`);
                        }
                    }
                } catch (err) {
                    console.error(`AutoApprovalWorker: Error processing session ${sessionId}`, err);
                }
            }));
        }

    } catch (error) {
        console.error("AutoApprovalWorker: Error during check cycle:", error);
    } finally {
        isRunning = false;
        scheduleNextRun();
    }
}

function scheduleNextRun() {
    if (workerTimeout) {
        clearTimeout(workerTimeout);
    }

    // Get interval from settings (default 60s)
    // We fetch this every time to pick up changes without restart
    db.select().from(settings).where(eq(settings.id, 1)).limit(1)
        .then(settingsResult => {
            let intervalSeconds = 60;
            if (settingsResult.length > 0) {
                intervalSeconds = settingsResult[0].autoApprovalInterval;
            }
            // Ensure reasonable minimum
            if (intervalSeconds < 10) intervalSeconds = 10;

            workerTimeout = setTimeout(() => {
                runAutoApprovalCheck();
            }, intervalSeconds * 1000);
        })
        .catch(e => {
            console.error("AutoApprovalWorker: Failed to fetch settings, using default interval.", e);
             workerTimeout = setTimeout(() => {
                runAutoApprovalCheck();
            }, 60 * 1000);
        });
}

export async function startAutoApprovalWorker() {
    console.log(`AutoApprovalWorker: Starting...`);
    // Run immediately once
    runAutoApprovalCheck();
}
