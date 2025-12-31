
import { db } from './db';
import { settings, locks } from './db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { listSources } from '@/app/sessions/actions';
import {
    listOpenPullRequests,
    getPullRequestChecks,
    getPullRequestComments,
    createPullRequestComment
} from './github-service';
import { getSettings } from './session-service';

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;
let hasStarted = false;

const WORKER_LOCK_ID = 'check_failing_actions_worker';

// Sleep helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runCheckFailingActions(options = { schedule: true }) {
    if (isRunning) return;
    isRunning = true;

    // Get settings
    const currentSettings = await getSettings();
    const enabled = currentSettings.checkFailingActionsEnabled ?? true;
    const intervalSeconds = currentSettings.checkFailingActionsInterval || 60;

    if (!enabled) {
        console.log("CheckFailingActionsWorker: Worker is disabled.");
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun(intervalSeconds);
        }
        return;
    }

    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        console.warn("CheckFailingActionsWorker: JULES_API_KEY not set. Skipping check.");
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun(intervalSeconds);
        }
        return;
    }

    try {
        // Attempt to acquire lock
        const hasLock = await acquireLock();
        if (!hasLock) {
            // console.log("CheckFailingActionsWorker: Could not acquire lock, another worker is running.");
        } else {
             await processRepositories(apiKey);
        }

    } catch (error: any) {
        console.error("CheckFailingActionsWorker: Error during check cycle:", error);
    } finally {
        // Release lock
        try {
            await db.delete(locks).where(eq(locks.id, WORKER_LOCK_ID));
        } catch (e) {
            console.error("CheckFailingActionsWorker: Failed to release lock", e);
        }

        isRunning = false;
        if (options.schedule) {
            scheduleNextRun(intervalSeconds);
        }
    }
}

async function acquireLock(): Promise<boolean> {
    const now = Date.now();
    const LOCK_DURATION_MS = 60 * 1000 * 5; // 5 minutes lock duration (generous)

    try {
        // 1. Delete expired locks
        await db.delete(locks).where(
            and(
                eq(locks.id, WORKER_LOCK_ID),
                lt(locks.expiresAt, now)
            )
        );

        // 2. Try to insert new lock
        await db.insert(locks).values({
            id: WORKER_LOCK_ID,
            expiresAt: now + LOCK_DURATION_MS
        });

        return true;
    } catch (e) {
        return false;
    }
}

async function processRepositories(apiKey: string) {
    console.log("CheckFailingActionsWorker: Checking repositories...");

    let sources = [];
    try {
        sources = await listSources(apiKey);
    } catch (e) {
        console.error("CheckFailingActionsWorker: Failed to list sources", e);
        return;
    }

    // Identify current user/bot to filter PRs
    // The requirement is "opened by Jules bot".
    // We'll search for "jules" in the author name or just check if it's a bot?
    // Let's assume the string "jules" in login name.
    const BOT_NAME_FILTER = "jules";

    // Also we need to identify "us" for comments.
    // Usually the bot token user is what we check against.
    // If we can't easily identify "us", we might double comment if the name doesn't match perfectly.
    // Ideally we should know our own login.
    // But since we use a token, we can assume comments by "us" have type 'Bot' and maybe similar name.

    for (const source of sources) {
        const repoFullName = `${source.githubRepo.owner}/${source.githubRepo.repo}`;
        console.log(`CheckFailingActionsWorker: Checking ${repoFullName}`);

        try {
            const prs = await listOpenPullRequests(repoFullName, BOT_NAME_FILTER);

            for (const pr of prs) {
                // Check checks
                const failingChecks = await getPullRequestChecks(repoFullName, pr.head.sha);

                if (failingChecks.length > 0) {
                    console.log(`CheckFailingActionsWorker: PR #${pr.number} in ${repoFullName} has failing checks: ${failingChecks.join(', ')}`);

                    // Check comments
                    const comments = await getPullRequestComments(repoFullName, pr.number);

                    // Check if last comment is by us
                    if (comments.length > 0) {
                        const lastComment = comments[comments.length - 1];
                        // Heuristic: If last comment mentions "@jules the git hub actions are failing", then we probably posted it.
                        // Or if the user is the bot.
                        // We don't know exact bot name, but we can check the content.
                        if (lastComment.body.includes("@jules the git hub actions are failing")) {
                             console.log(`CheckFailingActionsWorker: Last comment already about failing actions. Skipping.`);
                             continue;
                        }
                    }

                    // Post comment
                    const commentBody = `@jules the git hub actions are failing. Failing github actions: ${failingChecks.join(', ')}.`;
                    await createPullRequestComment(repoFullName, pr.number, commentBody);
                    console.log(`CheckFailingActionsWorker: Posted comment on PR #${pr.number} in ${repoFullName}`);
                }
            }

        } catch (e) {
            console.error(`CheckFailingActionsWorker: Error processing repo ${repoFullName}`, e);
        }

        // Slight delay between repos to be nice to API
        await sleep(1000);
    }
}

function scheduleNextRun(intervalSeconds: number) {
    if (workerTimeout) {
        clearTimeout(workerTimeout);
    }

    // Ensure at least 10 seconds to avoid crazy loops if interval is set to 0
    const finalInterval = Math.max(10, intervalSeconds);

    workerTimeout = setTimeout(() => {
        runCheckFailingActions();
    }, finalInterval * 1000);
}

export async function startCheckFailingActionsWorker() {
    if (hasStarted) {
        console.log("CheckFailingActionsWorker: Already started, skipping.");
        return;
    }
    hasStarted = true;
    console.log(`CheckFailingActionsWorker: Starting...`);
    runCheckFailingActions();
}
