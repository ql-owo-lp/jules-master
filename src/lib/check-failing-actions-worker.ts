
import { db } from './db';
import { settings, locks } from './db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { listSources } from '@/app/sessions/actions';
import {
    listOpenPullRequests,
    getPullRequestChecks,
    getAllCheckRuns,
    getCommit,
    getPullRequestComments,
    createPullRequestComment,
    addReactionToIssueComment,
    getPullRequest,
    getIssueComment,
    listPullRequestFiles,
    getFailingWorkflowRuns,
    rerunFailedJobs
} from './github-service';
import { getSettings } from './session-service';

const BOT_COMMENT_TAG_PREFIX = '<!-- jules-bot-check-failing-actions';
const BOT_COMMENT_TAG_SUFFIX = '-->';
const BOT_COMMENT_TAG = `${BOT_COMMENT_TAG_PREFIX} ${BOT_COMMENT_TAG_SUFFIX}`; // Legacy tag

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
    const intervalSeconds = currentSettings.checkFailingActionsInterval || 600;
    const maxCommentsThreshold = currentSettings.checkFailingActionsThreshold || 10;

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
             await processRepositories(apiKey, maxCommentsThreshold);
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

async function processRepositories(apiKey: string, maxCommentsThreshold: number) {
    console.log("CheckFailingActionsWorker: Checking repositories...");

    let sources = [];
    try {
        sources = await listSources(apiKey);
    } catch (e) {
        console.error("CheckFailingActionsWorker: Failed to list sources", e);
        return;
    }

    // Identify current user/bot to filter PRs
    const BOT_NAME_FILTER = "google-labs-jules"; 

    for (const source of sources) {
        const repoFullName = `${source.githubRepo.owner}/${source.githubRepo.repo}`;
        console.log(`CheckFailingActionsWorker: Checking ${repoFullName}`);

        try {
            // Updated: Pass author to filter PRs
            const prs = await listOpenPullRequests(repoFullName, BOT_NAME_FILTER);

            for (const pr of prs) {
                // Get Commit Info
                const commit = await getCommit(repoFullName, pr.head.sha);
                let commitDate = commit ? new Date(commit.commit.committer.date) : null;
                // Clamp commitDate to now to prevent future dates from causing infinite loops
                if (commitDate && commitDate.getTime() > Date.now()) {
                    console.warn(`CheckFailingActionsWorker: Commit date ${commitDate.toISOString()} is in the future. Clamping to now.`);
                    commitDate = new Date();
                }

                // Check all checks to see if any are pending
                const allChecks = await getAllCheckRuns(repoFullName, pr.head.sha);
                const pendingChecks = allChecks.filter(c => c.status !== 'completed');
                if (pendingChecks.length > 0) {
                     // console.log(`CheckFailingActionsWorker: PR #${pr.number} in ${repoFullName} has pending checks. Waiting...`);
                     continue;
                }

                // Check checks
                const failingChecks = await getPullRequestChecks(repoFullName, pr.head.sha);

                if (failingChecks.length > 0) {
                    const failingCheckNames = failingChecks.map(c => `- ${c.name}`).join('\n');
                    console.log(`CheckFailingActionsWorker: PR #${pr.number} in ${repoFullName} has failing checks:\n${failingCheckNames}`);

                    // Check comments
                    const comments = await getPullRequestComments(repoFullName, pr.number);

                    // Check if we already commented on this commit using the commit SHA in the tag
                    const alreadyCommentedOnSha = comments.some(c => {
                        return c.body.includes(`${BOT_COMMENT_TAG_PREFIX} commit:${pr.head.sha} ${BOT_COMMENT_TAG_SUFFIX}`);
                    });

                    if (alreadyCommentedOnSha) {
                         console.log(`CheckFailingActionsWorker: Already commented on commit ${pr.head.sha}. Skipping.`);
                         continue;
                    }

                    // Threshold Logic:
                    // We still respect the global threshold for spam prevention, but we reset it per commit implicitly
                    // by only checking recent comments? Or do we stick to "reset threshold" idea?
                    // The user said: "when jules bot uploaded a new commit ... we will reset the comment threshold".
                    // If we use the commit SHA in the tag, we know exactly if we commented on THIS commit.
                    // The threshold is mainly to prevent spamming if we *retry* and it fails again and we comment again on the SAME commit?
                    // But our logic above prevents commenting on the same commit SHA again.
                    // So the threshold is maybe less relevant per-commit, but good to keep as a safety valve.
                    // Let's count how many comments we made on this PR *in general* to be safe, OR just trust the SHA check.
                    // Actually, if we use SHA check, we only comment ONCE per commit. That is inherently limited.
                    // But if the user pushes 50 commits in an hour, we might post 50 comments.
                    // Let's keep the threshold check based on "relevant" comments (those on the current commit, which is 0 by definition here)
                    // Wait, if we haven't commented on this commit yet, 'ourRelevantComments' would be 0.
                    // So the threshold check essentially becomes: have we spammed *other* things?
                    // Let's just stick to the SHA check for now as the primary mechanism.

                    // Attempt to rerun failing jobs
                    try {
                        const failingRuns = await getFailingWorkflowRuns(repoFullName, pr.head.sha);
                        if (failingRuns.length > 0) {
                             console.log(`CheckFailingActionsWorker: Triggering rerun for failing workflow runs: ${failingRuns.join(', ')}`);
                             for (const runId of failingRuns) {
                                 await rerunFailedJobs(repoFullName, runId);
                             }
                        } else {
                            console.log(`CheckFailingActionsWorker: No failing workflow runs found for ${pr.head.sha} despite failing checks.`);
                        }
                    } catch (err) {
                        console.error(`CheckFailingActionsWorker: Error triggering reruns for PR #${pr.number}:`, err);
                    }

                    // Post comment
                    let commentBody = `@jules the GitHub actions are failing. Failing GitHub actions:\n${failingCheckNames}`;

                    // Add CodeQL details
                    const codeqlCheck = failingChecks.find(c => c.name.toLowerCase().includes('codeql'));
                    if (codeqlCheck && codeqlCheck.output) {
                         if (codeqlCheck.output.summary) {
                             commentBody += `\n\n**CodeQL Summary:**\n${codeqlCheck.output.summary}`;
                         }
                    }

                    // Check for merge conflicts
                    try {
                        const prDetails = await getPullRequest(repoFullName, pr.number);
                        if (prDetails && prDetails.mergeable === false) {
                            commentBody += `\n\nYou must rebase the branch on top of the latest target branch and resolve merge conflicts.`;
                        }
                    } catch (err) {
                        console.error(`CheckFailingActionsWorker: Error checking merge status for PR #${pr.number}:`, err);
                    }

                    // Check for deleted test files
                    try {
                         const files = await listPullRequestFiles(repoFullName, pr.number);
                         const deletedTestFiles = files.filter(f => 
                             f.status === 'removed' && 
                             (
                                 f.filename.endsWith('_test.go') || 
                                 f.filename.endsWith('.test.ts') || 
                                 f.filename.endsWith('.spec.ts') || 
                                 f.filename.endsWith('.test.js') || 
                                 f.filename.endsWith('.spec.js')
                             )
                         );

                         if (deletedTestFiles.length > 0) {
                             console.log(`CheckFailingActionsWorker: PR #${pr.number} deletes test files: ${deletedTestFiles.map(f => f.filename).join(', ')}`);
                             commentBody += `\n\nDeleting existing tests are not allowed, only refactor of these tests are allowed.`;
                         }
                    } catch (err) {
                        console.error(`CheckFailingActionsWorker: Error checking files for PR #${pr.number}:`, err);
                    }


                    // Append unique tag with commit SHA
                    commentBody += `\n\n${BOT_COMMENT_TAG_PREFIX} commit:${pr.head.sha} ${BOT_COMMENT_TAG_SUFFIX}`;

                    const commentId = await createPullRequestComment(repoFullName, pr.number, commentBody);
                    if (commentId) {
                         console.log(`CheckFailingActionsWorker: Posted comment on PR #${pr.number} in ${repoFullName}`);
                         // Remove auto-reaction. Instead, monitor for user reaction asynchronously.
                         // We do NOT await this promise to avoid blocking the worker loop.
                         monitorCommentReaction(repoFullName, commentId).catch(err => {
                             console.error(`CheckFailingActionsWorker: Error monitoring reaction for comment ${commentId}:`, err);
                         });
                    } else {
                         console.error(`CheckFailingActionsWorker: Failed to post comment on PR #${pr.number}`);
                    }
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

export function _resetForTest() {
    isRunning = false;
    hasStarted = false;
    if (workerTimeout) clearTimeout(workerTimeout);
    workerTimeout = null;
}

// Helper to monitor reaction status
async function monitorCommentReaction(repo: string, commentId: number) {
    console.log(`CheckFailingActionsWorker: Monitoring comment ${commentId} for user reaction (waiting 30s)...`);
    await sleep(30000); // Wait 30 seconds

    try {
        const comment = await getIssueComment(repo, commentId);
        if (!comment) {
             console.error(`CheckFailingActionsWorker: Could not fetch comment ${commentId} for monitoring.`);
             return;
        }

        // GitHub API response for issue comment includes 'reactions' object
        // Typings might need update or we can cast if not present in GitHubIssueComment
        const reactions = (comment as any).reactions; 
        if (reactions && reactions['eyes'] > 0) {
            console.log(`CheckFailingActionsWorker: [Jules replied] Eye reaction found on comment ${commentId}.`);
        } else {
            console.log(`CheckFailingActionsWorker: [Pending reaction] No eye reaction found on comment ${commentId} after 30s.`);
        }
    } catch (err) {
        console.error(`CheckFailingActionsWorker: Failed to monitor reaction for ${commentId}`, err);
    }
}
