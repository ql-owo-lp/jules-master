
import { db } from './db';
import { jobs, settings } from './db/schema';
import { eq } from 'drizzle-orm';
import { getSession, sendMessage } from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';

interface WorkerConfig {
    workerName: string;
    enabledSetting: keyof typeof settings.$inferSelect;
    intervalSetting: keyof typeof settings.$inferSelect;
    messageSetting?: keyof typeof settings.$inferSelect;
    sessionState: Session['state'];
    customLogic?: (session: Session) => boolean;
    getMessage: (settings: any) => string;
}

export function createWorker(config: WorkerConfig) {
    let workerTimeout: NodeJS.Timeout | null = null;
    let isRunning = false;

    async function runCheck() {
        if (isRunning) return;
        isRunning = true;

        const apiKey = process.env.JULES_API_KEY;
        if (!apiKey) {
            console.warn(`${config.workerName}: JULES_API_KEY not set. Skipping check.`);
            isRunning = false;
            scheduleNextRun();
            return;
        }

        try {
            const settingsResult = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
            if (!settingsResult[0] || !(settingsResult[0] as any)[config.enabledSetting]) {
                isRunning = false;
                scheduleNextRun();
                return;
            }

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
                        console.error(`${config.workerName}: Failed to parse sessionIds for job ${job.id}`, e);
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

            console.log(`${config.workerName}: Checking ${sessionIds.length} sessions...`);

            const CONCURRENCY_LIMIT = 5;
            for (let i = 0; i < sessionIds.length; i += CONCURRENCY_LIMIT) {
                const batch = sessionIds.slice(i, i + CONCURRENCY_LIMIT);
                await Promise.all(batch.map(async (sessionId) => {
                    try {
                        const session = await getSession(sessionId, apiKey);

                        let shouldSendMessage = session && session.state === config.sessionState;
                        if (shouldSendMessage && config.customLogic) {
                            shouldSendMessage = config.customLogic(session);
                        }

                        if (shouldSendMessage) {
                            console.log(`${config.workerName}: Messaging session ${sessionId}...`);
                            const message = config.getMessage(settingsResult[0]);
                            const result = await sendMessage(sessionId, message, apiKey);
                            if (result) {
                                console.log(`${config.workerName}: Session ${sessionId} messaged successfully.`);
                            } else {
                                console.error(`${config.workerName}: Failed to message session ${sessionId}.`);
                            }
                        }
                    } catch (err) {
                        console.error(`${config.workerName}: Error processing session ${sessionId}`, err);
                    }
                }));
            }

        } catch (error) {
            console.error(`${config.workerName}: Error during check cycle:`, error);
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
                    intervalSeconds = (settingsResult[0] as any)[config.intervalSetting];
                }
                if (intervalSeconds < 10) intervalSeconds = 10;

                workerTimeout = setTimeout(() => {
                    runCheck();
                }, intervalSeconds * 1000);
            })
            .catch(e => {
                console.error(`${config.workerName}: Failed to fetch settings, using default interval.`, e);
                 workerTimeout = setTimeout(() => {
                    runCheck();
                }, 60 * 1000);
            });
    }

    return {
        start: () => {
            console.log(`${config.workerName}: Starting...`);
            runCheck();
        }
    };
}
