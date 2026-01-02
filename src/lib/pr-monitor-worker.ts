
import { db } from './db';
import { locks } from './db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { listSources } from '@/app/sessions/actions';
import {
    listOpenPullRequests,
    getPullRequestCheckStatus,
    getPullRequestComments,
    createPullRequestComment,
    getPullRequest,
    getIssueComment,
    listPullRequestFiles,
    updatePullRequest,
    mergePullRequest,
    getFailingWorkflowRuns,
    rerunFailedJobs
} from './github-service';
import { getSettings } from './session-service';

const BOT_COMMENT_TAG_PREFIX = '<!-- jules-bot-check-failing-actions';
const BOT_COMMENT_TAG_SUFFIX = '-->';
const BOT_COMMENT_TAG = `${BOT_COMMENT_TAG_PREFIX} ${BOT_COMMENT_TAG_SUFFIX}`;

let workerTimeout: NodeJS.Timeout | null = null;
let isRunning = false;
let hasStarted = false;

const WORKER_LOCK_ID = 'pr_monitor_worker';

// Sleep helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runPrMonitor(options = { schedule: true }) {
    if (isRunning) return;
    isRunning = true;

    // Get settings
    const currentSettings = await getSettings();
    const enabled = currentSettings.checkFailingActionsEnabled ?? true;
    const intervalSeconds = currentSettings.checkFailingActionsInterval || 600;
    const maxCommentsThreshold = currentSettings.checkFailingActionsThreshold || 10;

    if (!enabled) {
        console.log("PrMonitorWorker: Worker is disabled.");
        isRunning = false;
        if (options.schedule) {
            scheduleNextRun(intervalSeconds);
        }
        return;
    }

    const apiKey = process.env.JULES_API_KEY;
    if (!apiKey) {
        console.warn("PrMonitorWorker: JULES_API_KEY not set. Skipping check.");
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
            // console.log("PrMonitorWorker: Could not acquire lock, another worker is running.");
        } else {
             await processRepositories(apiKey, maxCommentsThreshold);
        }

    } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        console.error("PrMonitorWorker: Error during check cycle:", error);
    } finally {
        // Release lock
        try {
            await db.delete(locks).where(eq(locks.id, WORKER_LOCK_ID));
        } catch {
            console.error("PrMonitorWorker: Failed to release lock");
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
    } catch {
        return false;
    }
}

async function processRepositories(apiKey: string, maxCommentsThreshold: number) {
    console.log("PrMonitorWorker: Checking repositories...");

    let sources = [];
    try {
        sources = await listSources(apiKey);
    } catch (_e) {
        console.error("PrMonitorWorker: Failed to list sources", _e);
        return;
    }

    // Identify current user/bot to filter PRs
    const BOT_NAME_FILTER = "google-labs-jules";

    for (const source of sources) {
        const repoFullName = `${source.githubRepo.owner}/${source.githubRepo.repo}`;
        console.log(`PrMonitorWorker: Checking ${repoFullName}`);

        try {
            // Updated: Pass author to filter PRs
            const prs = await listOpenPullRequests(repoFullName, BOT_NAME_FILTER);

            for (const pr of prs) {
                // Check checks
                const checkStatus = await getPullRequestCheckStatus(repoFullName, pr.head.sha);

                // --- 1. Handle Failing Checks ---
                if (checkStatus.status === 'failure') {
                    const failingChecks = checkStatus.runs
                        .filter(r => r.status === 'completed' && ['failure', 'timed_out', 'action_required', 'cancelled'].includes(r.conclusion || ''))
                        .map(r => r.name);

                    console.log(`PrMonitorWorker: PR #${pr.number} in ${repoFullName} has failing checks: ${failingChecks.join(', ')}`);

                    // Check comments
                    const comments = await getPullRequestComments(repoFullName, pr.number);

                    // 1. Check Threshold
                    const ourComments = comments.filter(c => c.body.includes(BOT_COMMENT_TAG));
                    if (ourComments.length >= maxCommentsThreshold) {
                         console.log(`PrMonitorWorker: PR #${pr.number} has reached comment threshold (${ourComments.length}/${maxCommentsThreshold}). Skipping.`);
                         continue;
                    }

                    // 2. Check if last comment is by us
                    if (comments.length > 0) {
                        const lastComment = comments[comments.length - 1];
                        if (lastComment.body.includes(BOT_COMMENT_TAG) || lastComment.body.includes("@jules the git hub actions are failing")) {
                             console.log(`PrMonitorWorker: Last comment already about failing actions. Skipping.`);
                             continue;
                        }
                    }

                    // Check if we already commented on this commit using the commit SHA in the tag
                    const alreadyCommentedOnSha = comments.some(c => {
                        return c.body.includes(`${BOT_COMMENT_TAG_PREFIX} commit:${pr.head.sha} ${BOT_COMMENT_TAG_SUFFIX}`);
                    });

                    if (alreadyCommentedOnSha) {
                         console.log(`PrMonitorWorker: Already commented on commit ${pr.head.sha}. Skipping.`);
                         continue;
                    }

                    // Attempt to rerun failing jobs
                    try {
                        const failingRuns = await getFailingWorkflowRuns(repoFullName, pr.head.sha);
                        if (failingRuns.length > 0) {
                             console.log(`PrMonitorWorker: Triggering rerun for failing workflow runs: ${failingRuns.join(', ')}`);
                             for (const runId of failingRuns) {
                                 await rerunFailedJobs(repoFullName, runId);
                             }
                        } else {
                            console.log(`PrMonitorWorker: No failing workflow runs found for ${pr.head.sha} despite failing checks.`);
                        }
                    } catch (err) {
                        console.error(`PrMonitorWorker: Error triggering reruns for PR #${pr.number}:`, err);
                    }

                    // Post comment
                    const failingChecksList = failingChecks.map(name => `- ${name}`).join('\n');
                    let commentBody = `@jules the git hub actions are failing. Failing GitHub actions:\n${failingChecksList}`;

                    // Add CodeQL details
                    const codeqlCheck = checkStatus.runs.find(c => c.name.toLowerCase().includes('codeql'));
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
                        console.error(`PrMonitorWorker: Error checking merge status for PR #${pr.number}:`, err);
                    }

                    // Check for deleted test files
                    try {
                         const files = await listPullRequestFiles(repoFullName, pr.number);
                         const deletedTestFiles = files.filter(f =>
                             f.status === 'removed' &&
                             isTestFile(f.filename)
                         );

                         if (deletedTestFiles.length > 0) {
                             console.log(`PrMonitorWorker: PR #${pr.number} deletes test files: ${deletedTestFiles.map(f => f.filename).join(', ')}`);
                             commentBody += `\n\nDeleting existing tests are not allowed, only refactor of these tests are allowed.`;
                         }
                    } catch (err) {
                        console.error(`PrMonitorWorker: Error checking files for PR #${pr.number}:`, err);
                    }


                    // Append unique tag with commit SHA
                    commentBody += `\n\n${BOT_COMMENT_TAG_PREFIX} commit:${pr.head.sha} ${BOT_COMMENT_TAG_SUFFIX}`;

                    const commentId = await createPullRequestComment(repoFullName, pr.number, commentBody);
                    if (commentId) {
                         console.log(`PrMonitorWorker: Posted comment on PR #${pr.number} in ${repoFullName}`);
                         monitorCommentReaction(repoFullName, commentId).catch(err => {
                             console.error(`PrMonitorWorker: Error monitoring reaction for comment ${commentId}:`, err);
                         });
                    } else {
                         console.error(`PrMonitorWorker: Failed to post comment on PR #${pr.number}`);
                    }
                }

                // --- 2. Handle Passing Checks ---
                else if (checkStatus.status === 'success') {
                    // console.log(`PrMonitorWorker: PR #${pr.number} has passing checks.`);

                    try {
                        const files = await listPullRequestFiles(repoFullName, pr.number);
                        const deletedTestFiles = files.filter(f => f.status === 'removed' && isTestFile(f.filename));
                        const anyFilesRemoved = files.some(f => f.status === 'removed');
                        const allFilesAreTests = files.every(f => isTestFile(f.filename));

                        // Strict addition check: 'added' status usually means new file.
                        // 'modified' might involve deletions.
                        // But let's check explicit line deletions count if available?
                        // GitHub file object has `deletions`.
                        // "PR diff is only adding test cases , without removing any existing tests cases"
                        // Safer to check total deletions across files? Or per file.
                        const totalDeletions = files.reduce((acc, f) => acc + (f.deletions || 0), 0);

                        // Fetch full PR details if we need 'mergeable' or 'draft' status
                        // pr object from listOpenPullRequests is Simple, but API response might include draft.
                        // The type definition I added has draft?.
                        // But let's fetch full to be safe and get mergeable state.
                        const prFull = await getPullRequest(repoFullName, pr.number);
                        if (!prFull) continue;

                        const isDraft = prFull.draft;
                        const isMergeable = prFull.mergeable; // null (checking), true, or false.

                        // Logic for "Ready to Review"
                        // Condition: All checks passing AND PR does not delete any existing test.
                        // And usually we only mark if it is currently a draft.
                        if (isDraft && deletedTestFiles.length === 0) {
                            console.log(`PrMonitorWorker: PR #${pr.number} is ready for review. Marking as ready.`);
                            // Mark as ready (update draft: false)
                            await updatePullRequest(repoFullName, pr.number, { draft: false });
                        }

                        // Logic for "Rebase and Merge"
                        // Condition: Diff is ONLY adding test cases (no removal of existing tests), and all checks pass.
                        // Implies:
                        // 1. All files are test files.
                        // 2. No test files removed (actually no files removed at all if we follow "only adding").
                        // 3. No deletions in content (strictly adding).
                        if (allFilesAreTests && !anyFilesRemoved && totalDeletions === 0) {
                            if (isMergeable) {
                                console.log(`PrMonitorWorker: PR #${pr.number} qualifies for auto-merge (only adding tests). Merging...`);
                                const merged = await mergePullRequest(repoFullName, pr.number, 'rebase');
                                if (merged) {
                                    console.log(`PrMonitorWorker: Successfully merged PR #${pr.number}.`);

                                    // Optionally delete branch (handled by another worker usually, but we can do it here too to be immediate)
                                    // The other worker `auto-delete-stale-branch` handles it.
                                } else {
                                    console.error(`PrMonitorWorker: Failed to merge PR #${pr.number}.`);
                                }
                            } else if (isMergeable === false) {
                                console.log(`PrMonitorWorker: PR #${pr.number} is not mergeable (conflicts).`);
                            }
                        }

                    } catch (err) {
                        console.error(`PrMonitorWorker: Error processing passing PR #${pr.number}:`, err);
                    }
                }
            }

        } catch (e) {
            console.error(`PrMonitorWorker: Error processing repo ${repoFullName}`, e);
        }

        // Slight delay between repos to be nice to API
        await sleep(1000);
    }
}

function isTestFile(filename: string): boolean {
    return filename.endsWith('_test.go') ||
           filename.endsWith('.test.ts') ||
           filename.endsWith('.spec.ts') ||
           filename.endsWith('.test.js') ||
           filename.endsWith('.spec.js');
}

function scheduleNextRun(intervalSeconds: number) {
    if (workerTimeout) {
        clearTimeout(workerTimeout);
    }

    // Ensure at least 10 seconds to avoid crazy loops if interval is set to 0
    const finalInterval = Math.max(10, intervalSeconds);

    workerTimeout = setTimeout(() => {
        runPrMonitor();
    }, finalInterval * 1000);
}

export async function startPrMonitorWorker() {
    if (hasStarted) {
        console.log("PrMonitorWorker: Already started, skipping.");
        return;
    }
    hasStarted = true;
    console.log(`PrMonitorWorker: Starting...`);
    runPrMonitor();
}

export function _resetForTest() {
    isRunning = false;
    hasStarted = false;
    if (workerTimeout) clearTimeout(workerTimeout);
    workerTimeout = null;
}

// Helper to monitor reaction status
async function monitorCommentReaction(repo: string, commentId: number) {
    console.log(`PrMonitorWorker: Monitoring comment ${commentId} for user reaction (waiting 30s)...`);
    await sleep(30000); // Wait 30 seconds

    try {
        const comment = await getIssueComment(repo, commentId);
        if (!comment) {
             console.error(`PrMonitorWorker: Could not fetch comment ${commentId} for monitoring.`);
             return;
        }

        // GitHub API response for issue comment includes 'reactions' object
        // Typings might need update or we can cast if not present in GitHubIssueComment
        const reactions = (comment as any).reactions; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (reactions && reactions['eyes'] > 0) {
            console.log(`PrMonitorWorker: [Jules replied] Eye reaction found on comment ${commentId}.`);
        } else {
            console.log(`PrMonitorWorker: [Pending reaction] No eye reaction found on comment ${commentId} after 30s.`);
        }
    } catch (err) {
        console.error(`PrMonitorWorker: Failed to monitor reaction for ${commentId}`, err);
    }
}
