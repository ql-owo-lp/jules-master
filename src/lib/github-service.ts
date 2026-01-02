
'use server';

import { fetchWithRetry } from './fetch-client';

export type GitHubIssueComment = {
    id: number;
    body: string;
    user: {
        login: string;
        type: string;
    };
    created_at: string;
    updated_at: string;
};

export type GitHubPullRequestSimple = {
    number: number;
    title: string;
    user: {
        login: string;
        type: string;
    };
    head: {
        sha: string;
        ref: string;
    };
    draft?: boolean;
};

export type GitHubPullRequestFull = GitHubPullRequestSimple & {
    mergeable: boolean | null;
    mergeable_state: string;
    merged: boolean;
    merged_at: string | null;
};

export type PullRequestCheckStatus = {
    status: 'unknown' | 'success' | 'failure' | 'pending';
    total: number;
    passed: number;
    pending: number;
    failed: number;
    runs: { name: string; status: string; conclusion: string | null; output?: { title?: string; summary?: string; text?: string } }[];
};

export async function listOpenPullRequests(repo: string, author?: string): Promise<GitHubPullRequestSimple[]> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return [];

    let url = `https://api.github.com/repos/${repo}/pulls?state=open&per_page=100`;

    try {
        const response = await fetchWithRetry(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) {
             console.error(`Failed to list PRs for ${repo}: ${response.status}`);
             return [];
        }

        const prs: GitHubPullRequestSimple[] = await response.json();

        if (author) {
            return prs.filter(pr => pr.user.login.toLowerCase().includes(author.toLowerCase()));
        }

        return prs;
    } catch (error) {
        console.error(`Error listing PRs for ${repo}:`, error);
        return [];
    }
}

export async function getFailingWorkflowRuns(repo: string, headSha: string): Promise<number[]> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return [];

    // https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#list-workflow-runs-for-a-repository
    const url = `https://api.github.com/repos/${repo}/actions/runs?head_sha=${headSha}&status=failure`;

    try {
        const response = await fetchWithRetry(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) {
             console.error(`Failed to list workflow runs for ${repo} ${headSha}: ${response.status}`);
             return [];
        }

        const data = await response.json();
        const runs = data.workflow_runs || [];

        return runs.map((run: any) => run.id);
    } catch (error) {
        console.error(`Error listing workflow runs for ${repo} ${headSha}:`, error);
        return [];
    }
}

export async function rerunFailedJobs(repo: string, runId: number): Promise<boolean> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return false;

    // https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#re-run-failed-jobs-from-a-workflow-run
    const url = `https://api.github.com/repos/${repo}/actions/runs/${runId}/rerun-failed-jobs`;

    try {
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (response.ok) {
            console.log(`Successfully triggered rerun for workflow run ${runId} in ${repo}`);
            return true;
        } else {
            const errorText = await response.text();
            console.error(`Failed to trigger rerun for workflow run ${runId} in ${repo}: ${response.status} ${response.statusText} - ${errorText}`);
            return false;
        }
    } catch (error) {
        console.error(`Error triggering rerun for workflow run ${runId} in ${repo}:`, error);
        return false;
    }
}

export async function getPullRequestCheckStatus(repo: string, ref: string): Promise<PullRequestCheckStatus> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return { status: 'unknown', total: 0, passed: 0, pending: 0, failed: 0, runs: [] };

    const url = `https://api.github.com/repos/${repo}/commits/${ref}/check-runs`;

    try {
        const response = await fetchWithRetry(url, {
             headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) {
            console.error(`Failed to get checks for ${repo} ${ref}: ${response.status}`);
            return { status: 'unknown', total: 0, passed: 0, pending: 0, failed: 0, runs: [] };
        }

        const data = await response.json();
        const runs = data.check_runs || [];

        const total = runs.length;
        const passed = runs.filter((run: any) => run.conclusion === 'success').length;
        // Pending: status is queued or in_progress. Or status completed but no conclusion (rare).
        const pendingCount = runs.filter((run: any) => run.status !== 'completed').length;
        const failedCount = runs.filter((run: any) =>
            run.status === 'completed' && ['failure', 'timed_out', 'action_required', 'cancelled'].includes(run.conclusion)
        ).length;

        let status: 'unknown' | 'success' | 'failure' | 'pending' = 'unknown';
        if (total === 0) {
            status = 'unknown';
        } else if (failedCount > 0) {
            status = 'failure';
        } else if (pendingCount > 0) {
            status = 'pending';
        } else {
            status = 'success';
        }

        return {
            status,
            total,
            passed,
            pending: pendingCount,
            failed: failedCount,
            runs: runs.map((r: any) => ({ 
                name: r.name, 
                status: r.status, 
                conclusion: r.conclusion,
                output: r.output // Added output here for CodeQL support
            }))
        };

    } catch (error) {
         console.error(`Error getting check status for ${repo} ${ref}:`, error);
         return { status: 'unknown', total: 0, passed: 0, pending: 0, failed: 0, runs: [] };
    }
}

export interface CheckRunFull {
    name: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
    output?: {
        title?: string;
        summary?: string;
        text?: string;
    };
}

export async function getAllCheckRuns(repo: string, ref: string): Promise<CheckRunFull[]> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return [];

    let allRuns: CheckRunFull[] = [];
    let page = 1;
    const perPage = 100;

    try {
        while (true) {
            const url = `https://api.github.com/repos/${repo}/commits/${ref}/check-runs?per_page=${perPage}&page=${page}`;
            const response = await fetchWithRetry(url, {
                 headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
            });

            if (!response.ok) {
                console.error(`Failed to get checks for ${repo} ${ref}: ${response.status}`);
                break;
            }

            const data = await response.json();
            const runs = data.check_runs || [];
            allRuns = allRuns.concat(runs);

            if (runs.length < perPage) {
                break;
            }
            page++;
        }
        return allRuns;
    } catch (error) {
         console.error(`Error getting all checks for ${repo} ${ref}:`, error);
         return allRuns;
    }
}

export async function getCommit(repo: string, sha: string): Promise<any | null> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return null;

    const url = `https://api.github.com/repos/${repo}/commits/${sha}`;

    try {
        const response = await fetchWithRetry(url, {
             headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
         console.error(`Error getting commit ${repo} ${sha}:`, error);
         return null;
    }
}

export async function getPullRequestChecks(repo: string, ref: string): Promise<string[]> {
    // Legacy support wrapper or keep for simple list of failing checks
    const status = await getPullRequestCheckStatus(repo, ref);
    if (status.status === 'failure') {
        return status.runs
            .filter(r => r.status === 'completed' && ['failure', 'timed_out', 'action_required', 'cancelled'].includes(r.conclusion || ''))
            .map(r => r.name);
    }
    return [];
}

export async function getPullRequestComments(repo: string, prNumber: number): Promise<GitHubIssueComment[]> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return [];

    const url = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100`;

    try {
         const response = await fetchWithRetry(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error(`Error getting comments for ${repo} #${prNumber}:`, error);
        return [];
    }
}

export async function createPullRequestComment(repo: string, prNumber: number, body: string): Promise<number | null> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return null;

    const url = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;

    try {
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ body }),
        });

        if (response.ok) {
            const data = await response.json();
            return data.id;
        }
        console.error(`Failed to create comment: ${response.status} ${response.statusText}`);
        return null;
    } catch (error) {
        console.error(`Error creating comment on ${repo} #${prNumber}:`, error);
        return null;
    }
}

export async function addReactionToIssueComment(repo: string, commentId: number, content: 'eyes' | '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket'): Promise<boolean> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return false;

    const url = `https://api.github.com/repos/${repo}/issues/comments/${commentId}/reactions`;

    try {
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content }),
        });

        return response.ok;
    } catch (error) {
        console.error(`Error adding reaction to comment ${commentId} in ${repo}:`, error);
        return false;
    }
}

export async function getPullRequest(repo: string, prNumber: number): Promise<GitHubPullRequestFull | null> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return null;

    const url = `https://api.github.com/repos/${repo}/pulls/${prNumber}`;

    try {
        const response = await fetchWithRetry(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error(`Error fetching PR ${repo} #${prNumber}:`, error);
        return null;
    }
}

export async function getIssueComment(repo: string, commentId: number): Promise<GitHubIssueComment | null> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return null;

    const url = `https://api.github.com/repos/${repo}/issues/comments/${commentId}`;

    try {
        const response = await fetchWithRetry(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error(`Error fetching comment ${repo} ${commentId}:`, error);
        return null;
    }
}

export async function deleteBranch(repo: string, branch: string): Promise<boolean> {
    if (['main', 'master', 'develop'].includes(branch)) {
        console.warn(`Attempted to delete protected branch ${branch} in ${repo}, preventing deletion.`);
        return false;
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        console.warn('GitHub token not configured, skipping branch deletion.');
        return false;
    }

    const url = `https://api.github.com/repos/${repo}/git/refs/heads/${branch}`;

    try {
        const response = await fetchWithRetry(url, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (response.ok) {
            return true;
        } else if (response.status === 404) {
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error deleting branch ${branch} from ${repo}:`, error);
        return false;
    }
}

export async function listPullRequestFiles(repo: string, prNumber: number): Promise<any[]> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return [];

    const url = `https://api.github.com/repos/${repo}/pulls/${prNumber}/files?per_page=100`;

    try {
        const response = await fetchWithRetry(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (response.ok) {
            return await response.json();
        }
        return [];
    } catch (error) {
        console.error(`Error listing files for PR #${prNumber} in ${repo}:`, error);
        return [];
    }
}

export async function updatePullRequest(repo: string, prNumber: number, updates: { title?: string; body?: string; state?: 'open' | 'closed'; draft?: boolean; maintainer_can_modify?: boolean }): Promise<GitHubPullRequestFull | null> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return null;

    const url = `https://api.github.com/repos/${repo}/pulls/${prNumber}`;

    try {
        const response = await fetchWithRetry(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
        });

        if (response.ok) {
            return await response.json();
        }
        console.error(`Failed to update PR #${prNumber} in ${repo}: ${response.status} ${response.statusText}`);
        return null;
    } catch (error) {
        console.error(`Error updating PR #${prNumber} in ${repo}:`, error);
        return null;
    }
}

export async function mergePullRequest(repo: string, prNumber: number, method: 'merge' | 'squash' | 'rebase' = 'merge'): Promise<boolean> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return false;

    const url = `https://api.github.com/repos/${repo}/pulls/${prNumber}/merge`;

    try {
        const response = await fetchWithRetry(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ merge_method: method }),
        });

        if (response.ok) {
            return true;
        }
        console.error(`Failed to merge PR #${prNumber} in ${repo}: ${response.status} ${response.statusText}`);
        return false;
    } catch (error) {
        console.error(`Error merging PR #${prNumber} in ${repo}:`, error);
        return false;
    }
}
