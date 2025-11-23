
import { db } from './db';
import { jobs, settings } from './db/schema';
import { eq } from 'drizzle-orm';
import { approvePlan, listSessions } from '@/app/sessions/actions';

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;

export async function runAutoApprovalCheck() {
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
        console.log("AutoApprovalWorker: Starting comprehensive check...");

        // 1. Fetch all sessions
        const allSessions = await listSessions(apiKey);
        const pendingSessions = allSessions.filter(s => s.state === 'AWAITING_PLAN_APPROVAL');

        if (pendingSessions.length === 0) {
            console.log("AutoApprovalWorker: No pending sessions found.");
            isRunning = false;
            scheduleNextRun();
            return;
        }

        // 2. Fetch all jobs to determine exclusion list
        const allJobs = await db.select().from(jobs);

        // Identify sessions that belong to jobs with autoApproval explicitly set to FALSE
        const excludedSessionIds = new Set<string>();

        for (const job of allJobs) {
            if (job.autoApproval === false) {
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
                    ids.forEach(id => excludedSessionIds.add(id));
                }
            }
        }

        // 3. Filter sessions to approve
        // We approve sessions that are NOT in the excluded list.
        // This includes sessions in auto-approval jobs AND ungrouped sessions.
        const sessionsToApprove = pendingSessions.filter(s => !excludedSessionIds.has(s.id));

        if (sessionsToApprove.length === 0) {
             console.log("AutoApprovalWorker: No eligible sessions to approve.");
        } else {
             console.log(`AutoApprovalWorker: Found ${sessionsToApprove.length} sessions to approve.`);

             // 4. Approve sessions
             // limiting concurrency to 5 requests at a time
            const CONCURRENCY_LIMIT = 5;
            const sessionIds = sessionsToApprove.map(s => s.id);

            for (let i = 0; i < sessionIds.length; i += CONCURRENCY_LIMIT) {
                const batch = sessionIds.slice(i, i + CONCURRENCY_LIMIT);
                await Promise.all(batch.map(async (sessionId) => {
                    try {
                        console.log(`AutoApprovalWorker: Approving session ${sessionId}...`);
                        const result = await approvePlan(sessionId, apiKey);
                        if (result) {
                            console.log(`AutoApprovalWorker: Session ${sessionId} approved successfully.`);
                        } else {
                            console.error(`AutoApprovalWorker: Failed to approve session ${sessionId}.`);
                        }
                    } catch (err) {
                        console.error(`AutoApprovalWorker: Error processing session ${sessionId}`, err);
                    }
                }));
            }
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
