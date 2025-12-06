
import { db } from './db';
import { profiles } from './db/schema';
import { eq } from 'drizzle-orm';
import { fetchSessionsPage } from '@/app/sessions/actions';
import { approvePlan } from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;

export async function runAutoApprovalCheck(options = { schedule: true }) {
    if (isRunning) return;
    isRunning = true;

    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        console.warn("AutoApprovalWorker: JULES_API_KEY not set. Skipping check.");
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun();
        }
        return;
    }

    try {
        console.log("AutoApprovalWorker: Starting check for all sessions...");

    const activeProfile = await db.query.profiles.findFirst({ where: eq(profiles.isActive, true) });
    const autoApprovalEnabled = activeProfile ? activeProfile.autoApprovalEnabled : false;

        if (!autoApprovalEnabled) {
            console.log("AutoApprovalWorker: Auto-approval is disabled. Skipping approval part of the check.");
        }

        let nextPageToken: string | undefined = undefined;
        let processedCount = 0;
        let approvedCount = 0;

        do {
            // Fetch a page of sessions
            const result = await fetchSessionsPage(apiKey, nextPageToken, 50);
            const sessions = result.sessions;
            nextPageToken = result.nextPageToken;

            if (sessions.length === 0) break;

            processedCount += sessions.length;

            // Filter for sessions awaiting plan approval
            const pendingSessions = sessions.filter(s => s.state === 'AWAITING_PLAN_APPROVAL');

            if (pendingSessions.length > 0 && autoApprovalEnabled) {
                 console.log(`AutoApprovalWorker: Found ${pendingSessions.length} pending sessions in current batch. Approving...`);

                 // Approve them
                 // limiting concurrency to 5 requests at a time
                 const CONCURRENCY_LIMIT = 5;
                 for (let i = 0; i < pendingSessions.length; i += CONCURRENCY_LIMIT) {
                     const batch = pendingSessions.slice(i, i + CONCURRENCY_LIMIT);
                     await Promise.all(batch.map(async (session) => {
                         try {
                             console.log(`AutoApprovalWorker: Approving session ${session.id}...`);
                             const result = await approvePlan(session.id, apiKey);
                             if (result) {
                                 console.log(`AutoApprovalWorker: Session ${session.id} approved successfully.`);
                                 approvedCount++;
                             } else {
                                 console.error(`AutoApprovalWorker: Failed to approve session ${session.id}.`);
                             }
                         } catch (err) {
                             console.error(`AutoApprovalWorker: Error processing session ${session.id}`, err);
                         }
                     }));
                 }
            }

        } while (nextPageToken);

        console.log(`AutoApprovalWorker: Cycle complete. Processed ${processedCount} sessions, approved ${approvedCount}.`);

    } catch (error) {
        console.error("AutoApprovalWorker: Error during check cycle:", error);
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

    // Get interval from settings (default 60s)
    // We fetch this every time to pick up changes without restart
db.query.profiles.findFirst({ where: eq(profiles.isActive, true) })
    .then(activeProfile => {
            let intervalSeconds = 60;
        if (activeProfile) {
            intervalSeconds = activeProfile.autoApprovalInterval;
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

// For testing purposes only
export function _resetForTest() {
    isRunning = false;
    if (workerTimeout) {
        clearTimeout(workerTimeout);
        workerTimeout = null;
    }
}
