
import { db } from './db';
import { jobs, settings, processedSessions } from './db/schema';
import { eq, and, notInArray } from 'drizzle-orm';
import { getSession, sendMessage } from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';

type AutomationConfig = {
    name: string;
    settingEnabled: keyof typeof settings.$inferSelect;
    intervalSetting: keyof typeof settings.$inferSelect;
    messageSetting: keyof typeof settings.$inferSelect;
    sessionState: Session['state'];
    checkPullRequest: boolean;
};

let workerTimeouts: Record<string, NodeJS.Timeout | null> = {};

async function runAutomationCheck(config: AutomationConfig) {
    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        console.warn(`${config.name}: JULES_API_KEY not set. Skipping check.`);
        scheduleNextRun(config);
        return;
    }

    try {
        const settingsResult = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
        if (settingsResult.length === 0 || !settingsResult[0][config.settingEnabled]) {
            scheduleNextRun(config);
            return;
        }

        const message = settingsResult[0][config.messageSetting] as string;

        // Get sessions that have already been processed for this automation type
        const processed = await db.select({ sessionId: processedSessions.sessionId }).from(processedSessions).where(eq(processedSessions.automationType, config.name));
        const processedIds = processed.map(p => p.sessionId);

        const allJobs = await db.select().from(jobs);
        if (allJobs.length === 0) {
            scheduleNextRun(config);
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
                    console.error(`${config.name}: Failed to parse sessionIds for job ${job.id}`, e);
                    continue;
                }
            }
            if (ids && Array.isArray(ids)) {
                sessionIds.push(...ids);
            }
        }

        const unprocessedSessionIds = sessionIds.filter(id => !processedIds.includes(id));

        if (unprocessedSessionIds.length === 0) {
            scheduleNextRun(config);
            return;
        }

        console.log(`${config.name}: Checking ${unprocessedSessionIds.length} sessions...`);

        const CONCURRENCY_LIMIT = 5;
        for (let i = 0; i < unprocessedSessionIds.length; i += CONCURRENCY_LIMIT) {
            const batch = unprocessedSessionIds.slice(i, i + CONCURRENCY_LIMIT);
            await Promise.all(batch.map(async (sessionId) => {
                try {
                    const session = await getSession(sessionId, apiKey);

                    let shouldProcess = session && session.state === config.sessionState;
                    if (config.checkPullRequest) {
                        shouldProcess = shouldProcess && !session.pullRequestUrl;
                    }

                    if (shouldProcess) {
                        console.log(`${config.name}: Processing session ${sessionId}...`);
                        const result = await sendMessage(sessionId, message, apiKey);
                        if (result) {
                            console.log(`${config.name}: Session ${sessionId} processed successfully.`);
                            // Mark as processed
                            await db.insert(processedSessions).values({ sessionId, automationType: config.name });
                        } else {
                            console.error(`${config.name}: Failed to process session ${sessionId}.`);
                        }
                    }
                } catch (err) {
                    console.error(`${config.name}: Error processing session ${sessionId}`, err);
                }
            }));
        }

    } catch (error) {
        console.error(`${config.name}: Error during check cycle:`, error);
    } finally {
        scheduleNextRun(config);
    }
}

function scheduleNextRun(config: AutomationConfig) {
    if (workerTimeouts[config.name]) {
        clearTimeout(workerTimeouts[config.name]!);
    }

    db.select().from(settings).where(eq(settings.id, 1)).limit(1)
        .then(settingsResult => {
            let intervalSeconds = 60;
            if (settingsResult.length > 0) {
                const settingValue = settingsResult[0][config.intervalSetting];
                if (typeof settingValue === 'number') {
                    intervalSeconds = settingValue;
                }
            }
            if (intervalSeconds < 10) intervalSeconds = 10;

            workerTimeouts[config.name] = setTimeout(() => {
                runAutomationCheck(config);
            }, intervalSeconds * 1000);
        })
        .catch(e => {
            console.error(`${config.name}: Failed to fetch settings, using default interval.`, e);
             workerTimeouts[config.name] = setTimeout(() => {
                runAutomationCheck(config);
            }, 60 * 1000);
        });
}

export async function startAutomationWorker(config: AutomationConfig) {
    console.log(`${config.name}: Starting...`);
    runAutomationCheck(config);
}
