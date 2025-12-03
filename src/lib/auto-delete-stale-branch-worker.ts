
import { db } from './db';
import { settings } from './db/schema';
import { eq } from 'drizzle-orm';
import { fetchSessionsPage } from '@/app/sessions/actions';
import { getPullRequestStatus } from '@/app/github/actions';
import { deleteBranch } from './github-service';
import type { Session } from '@/lib/types';

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;

export async function runAutoDeleteStaleBranchCheck(options = { schedule: true }) {
    if (isRunning) return;
    isRunning = true;

    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        console.warn("AutoDeleteStaleBranchWorker: JULES_API_KEY not set. Skipping check.");
        isRunning = false;
        // finally block will handle scheduling
        return;
    }

    try {
        console.log("AutoDeleteStaleBranchWorker: Starting check for all sessions...");

        const settingsResult = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
        if (settingsResult.length === 0 || !settingsResult[0].autoDeleteStaleBranches) {
            console.log("AutoDeleteStaleBranchWorker: Auto-delete stale branches is disabled in settings. Skipping check.");
            isRunning = false;
            // finally block will handle scheduling
            return;
        }

        const autoDeleteDays = settingsResult[0].autoDeleteStaleBranchesAfterDays;
        const now = new Date();

        let nextPageToken: string | undefined = undefined;
        let processedCount = 0;
        let deletedCount = 0;

        do {
            const result = await fetchSessionsPage(apiKey, nextPageToken, 50);
            const sessions = result.sessions;
            nextPageToken = result.nextPageToken;

            if (sessions.length === 0) break;

            processedCount += sessions.length;

            const completedSessions = sessions.filter(s => s.state === 'COMPLETED');

            for (const session of completedSessions) {
                if (session.outputs && session.outputs.length > 0 && session.outputs[0].pullRequest) {
                    const prUrl = session.outputs[0].pullRequest.url;
                    const prStatus = await getPullRequestStatus(prUrl);

                    if (prStatus && prStatus.state === 'MERGED' && prStatus.merged_at) {
                        const mergedAt = new Date(prStatus.merged_at);
                        const daysSinceMerge = (now.getTime() - mergedAt.getTime()) / (1000 * 60 * 60 * 24);

                        if (daysSinceMerge > autoDeleteDays) {
                            if (session.sourceContext?.githubRepoContext?.startingBranch) {
                                const repo = session.sourceContext.source.replace('sources/github/', '');
                                const branch = session.sourceContext.githubRepoContext.startingBranch;
                                console.log(`AutoDeleteStaleBranchWorker: Deleting stale branch ${branch} from ${repo}...`);
                                const deleted = await deleteBranch(repo, branch);
                                if (deleted) {
                                    deletedCount++;
                                }
                            }
                        }
                    }
                }
            }
        } while (nextPageToken);

        console.log(`AutoDeleteStaleBranchWorker: Cycle complete. Processed ${processedCount} sessions, deleted ${deletedCount} branches.`);

    } catch (error) {
        console.error("AutoDeleteStaleBranchWorker: Error during check cycle:", error);
    } finally {
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun(options);
        }
    }
}

const DEFAULT_INTERVAL_SECONDS = 3600;

function scheduleNextRun(options = { schedule: true }) {
    if (workerTimeout) {
        clearTimeout(workerTimeout);
    }

    db.select().from(settings).where(eq(settings.id, 1)).limit(1)
        .then(settingsResult => {
            const intervalSeconds = settingsResult[0]?.autoDeleteStaleBranchesInterval ?? DEFAULT_INTERVAL_SECONDS;
            workerTimeout = setTimeout(() => {
                runAutoDeleteStaleBranchCheck(options);
            }, intervalSeconds * 1000);
        })
        .catch(e => {
            console.error("AutoDeleteStaleBranchWorker: Failed to fetch settings, using default interval.", e);
            workerTimeout = setTimeout(() => {
                runAutoDeleteStaleBranchCheck(options);
            }, DEFAULT_INTERVAL_SECONDS * 1000);
        });
}

export async function startAutoDeleteStaleBranchWorker() {
    console.log(`AutoDeleteStaleBranchWorker: Starting...`);
    runAutoDeleteStaleBranchCheck();
}

export function _resetForTest() {
    isRunning = false;
    if (workerTimeout) {
        clearTimeout(workerTimeout);
        workerTimeout = null;
    }
}
