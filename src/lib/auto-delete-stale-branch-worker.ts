import { db } from './db';
import { settings } from './db/schema';
import { eq } from 'drizzle-orm';
import { listSources } from '@/app/sessions/actions';
import { deleteBranch, listBranches, listOpenPullRequests, getCommit } from './github-service';

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;

export async function runAutoDeleteStaleBranchCheck(options = { schedule: true }) {
    if (isRunning) return;
    isRunning = true;

    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        console.warn("AutoDeleteStaleBranchWorker: JULES_API_KEY not set. Skipping check.");
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun();
        }
        return;
    }

    try {
        console.log("AutoDeleteStaleBranchWorker: Starting check for stale branches...");

        const settingsResult = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
        // Use existing settings
        if (settingsResult.length === 0 || !settingsResult[0].autoDeleteStaleBranches) {
            console.log("AutoDeleteStaleBranchWorker: Auto-delete stale branches is disabled in settings. Skipping check.");
            isRunning = false;
            if (options.schedule) {
                scheduleNextRun();
            }
            return;
        }

        const autoDeleteDays = settingsResult[0].autoDeleteStaleBranchesAfterDays;
        const now = Date.now();

        // New Logic: Iterate all sources (repos) and check branches directly
        let sources = [];
        try {
            sources = await listSources(apiKey);
        } catch (e) {
            console.error("AutoDeleteStaleBranchWorker: Failed to list sources", e);
            return;
        }

        let deletedCount = 0;

        for (const source of sources) {
            const repoFullName = `${source.githubRepo.owner}/${source.githubRepo.repo}`;
            console.log(`AutoDeleteStaleBranchWorker: Checking ${repoFullName}`);

            try {
                const branches = await listBranches(repoFullName);
                const openPrs = await listOpenPullRequests(repoFullName, "google-labs-jules");
                const openPrHeadRefs = new Set(openPrs.map(pr => pr.head.ref));

                for (const branch of branches) {
                    if (branch.protected) continue;
                    if (['main', 'master', 'develop'].includes(branch.name)) continue;

                    // 1. Check if branch has an open PR
                    if (openPrHeadRefs.has(branch.name)) {
                        continue; // Skip branches with open PRs
                    }

                    // 2. Check if branch was updated recently
                    // We need to fetch commit details to get the date and author
                    try {
                        const commit = await getCommit(repoFullName, branch.commit.sha);
                        if (!commit) continue;

                        // 3. Check Author: Must be created by the bot
                        const author = commit.commit.author.name;
                        const committer = commit.commit.committer.name;
                        const isBot = author === 'google-labs-jules' || committer === 'google-labs-jules';

                        if (!isBot) {
                            continue; // Skip branches not created by bot
                        }

                        const lastUpdated = new Date(commit.commit.committer.date).getTime();
                        const daysSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60 * 24);

                        if (daysSinceUpdate > autoDeleteDays) {
                            console.log(`AutoDeleteStaleBranchWorker: Deleting stale orphan branch ${branch.name} from ${repoFullName} (last updated ${daysSinceUpdate.toFixed(1)} days ago)...`);
                            const deleted = await deleteBranch(repoFullName, branch.name);
                            if (deleted) {
                                deletedCount++;
                            }
                        }

                    } catch (err) {
                        console.error(`AutoDeleteStaleBranchWorker: Error checking branch ${branch.name} in ${repoFullName}:`, err);
                    }
                }
            } catch (repoErr) {
                console.error(`AutoDeleteStaleBranchWorker: Error processing repo ${repoFullName}:`, repoErr);
            }
        }

        console.log(`AutoDeleteStaleBranchWorker: Cycle complete. Deleted ${deletedCount} stale orphan branches.`);

    } catch (error) {
        console.error("AutoDeleteStaleBranchWorker: Error during check cycle:", error);
    } finally {
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun();
        }
    }
}

const DEFAULT_INTERVAL_SECONDS = 3600;

function scheduleNextRun() {
    if (workerTimeout) {
        clearTimeout(workerTimeout);
    }

    db.select().from(settings).where(eq(settings.id, 1)).limit(1)
        .then(settingsResult => {
            const intervalSeconds = settingsResult[0]?.autoDeleteStaleBranchesInterval ?? DEFAULT_INTERVAL_SECONDS;
            workerTimeout = setTimeout(() => {
                runAutoDeleteStaleBranchCheck();
            }, intervalSeconds * 1000);
        })
        .catch(e => {
            console.error("AutoDeleteStaleBranchWorker: Failed to fetch settings, using default interval.", e);
            workerTimeout = setTimeout(() => {
                runAutoDeleteStaleBranchCheck();
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
