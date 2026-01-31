
import { db } from './db';
import { jobs, cronJobs } from './db/schema';
import { getSettings } from './session-service';
import { listOpenPullRequests, getPullRequest, createPullRequestComment, getPullRequestChecks, updatePullRequest, mergePullRequest, getPullRequestCheckStatus, searchOpenPullRequests } from './github-service';
// Unused imports sections removed

let isWorkerRunning = false;

export function startPrMonitorWorker() {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    console.log('Starting PR Monitor Worker...');
    runWorkerLoop();
}

async function runWorkerLoop() {
    while (true) {
        try {
            await processPrs();
        } catch (error) {
            console.error('Error in PR Monitor Worker:', error);
        }

        // Fetch settings to determine interval
        try {
            const settings = await getSettings('default');
            // Default to 10 minutes (600000ms) if not set or too low
            const interval = Math.max((settings.checkFailingActionsInterval || 600) * 1000, 10000); 
            await new Promise(resolve => setTimeout(resolve, interval));
        } catch {
             await new Promise(resolve => setTimeout(resolve, 600000)); // Fallback 10m
        }
    }
}

async function processPrs() {
    const settings = await getSettings('default');
    
    // 1. Identify active repositories from jobs and cronJobs
    // We want to monitor repos that are relevant to the user.
    const activeJobs = await db.selectDistinct({ repo: jobs.repo }).from(jobs);
    const activeCronJobs = await db.selectDistinct({ repo: cronJobs.repo }).from(cronJobs);
    
    const uniqueRepos = new Set([
        ...activeJobs.map(j => j.repo),
        ...activeCronJobs.map(j => j.repo)
    ].filter(Boolean));

    console.log(`[PR Monitor] Monitoring ${uniqueRepos.size} repositories:`, [...uniqueRepos]);

    for (const repo of uniqueRepos) {
        await processRepoPrs(repo, settings);
    }
}


async function processRepoPrs(repo: string, settings: { closePrOnConflictEnabled: boolean; checkFailingActionsEnabled: boolean; autoMergeEnabled: boolean; autoMergeMethod: string; autoMergeMessage: string; }) {
    try {
        let prs;
        if (settings.autoMergeEnabled) {
             const token = process.env.GITHUB_TOKEN || "";
             const searchResult = await searchOpenPullRequests(repo, "is:pr state:open status:success", token);
             prs = searchResult.items;
        } else {
             prs = await listOpenPullRequests(repo);
        }
        
        for (const pr of prs) {
            try {
                // Fetch full PR details to check mergeable state
                const fullPr = await getPullRequest(repo, pr.number);
                if (!fullPr) continue;

                // 1. Auto Close on Conflict
                if (settings.closePrOnConflictEnabled) {
                    if (fullPr.mergeable === false) {
                        console.log(`[PR Monitor] Closing PR #${pr.number} in ${repo} due to merge conflicts.`);
                        
                        await createPullRequestComment(repo, pr.number, 
                            "Auto-closing this PR because it has merge conflicts. Please resolve conflicts and reopen, or open a new PR."
                        );
                        
                        await updatePullRequest(repo, pr.number, { state: 'closed' });
                        continue; // Stop processing this PR
                    }
                }
                
                // 2. Check Failing Actions
                if (settings.checkFailingActionsEnabled) {
                    const failedChecks = await getPullRequestChecks(repo, fullPr.head.sha);
                    if (failedChecks.length > 0) {
                         console.log(`[PR Monitor] PR #${pr.number} in ${repo} has failing checks: ${failedChecks.join(', ')}`);
                    }
                }

                // 3. Auto Merge
                if (settings.autoMergeEnabled) {
                    if (fullPr.mergeable === true && fullPr.mergeable_state !== 'dirty' && fullPr.mergeable_state !== 'blocked') {
                         const checkStatus = await getPullRequestCheckStatus(repo, fullPr.head.sha);
                         
                         if (checkStatus.status === 'success' || (checkStatus.status === 'unknown' && checkStatus.total === 0)) {
                             console.log(`[PR Monitor] Auto-merging PR #${pr.number} in ${repo} (Status: ${checkStatus.status})`);
                             
                             // Post message if configured
                             if (settings.autoMergeMessage) {
                                  await createPullRequestComment(repo, pr.number, settings.autoMergeMessage);
                             }

                             const merged = await mergePullRequest(repo, pr.number, settings.autoMergeMethod as 'merge' | 'squash' | 'rebase');
                             if (merged) {
                                 console.log(`[PR Monitor] Successfully merged PR #${pr.number}`);
                                 continue; // Done with this PR
                             } else {
                                 console.error(`[PR Monitor] Failed to merge PR #${pr.number}`);
                             }
                         }
                    }
                }

            } catch (prError) {
                console.error(`[PR Monitor] Error processing PR #${pr.number} in ${repo}:`, prError);
            }
        }
    } catch (repoError) {
        console.error(`[PR Monitor] Error processing repo ${repo}:`, repoError);
    }
}
