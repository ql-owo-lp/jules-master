
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
    };
};

export async function listOpenPullRequests(repo: string, author?: string): Promise<GitHubPullRequestSimple[]> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return [];

    let url = `https://api.github.com/repos/${repo}/pulls?state=open&per_page=100`;
    // If author is provided, we can't filter directly in the API call for list pulls unless we use search API.
    // List pulls API lists all pulls.
    // Search API is better for filtering: `is:pr is:open repo:${repo} author:${author}`
    // But let's use list and filter locally for simplicity if the volume is low, or search if we expect many.
    // Let's use list and filter locally to avoid search rate limits which are lower.

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

export async function getPullRequestChecks(repo: string, ref: string): Promise<string[]> {
    // We want to get the check runs for a specific commit SHA (ref)
    const token = process.env.GITHUB_TOKEN;
    if (!token) return [];

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
            return [];
        }

        const data = await response.json();
        const runs = data.check_runs || [];

        // Filter for failing runs
        // status: queued, in_progress, completed
        // conclusion: success, failure, neutral, cancelled, skipped, timed_out, action_required

        // We only care about completed and failing checks
        const failing = runs
            .filter((run: any) => run.status === 'completed' && ['failure', 'timed_out', 'action_required', 'cancelled'].includes(run.conclusion))
            .map((run: any) => run.name);

        return failing;
    } catch (error) {
         console.error(`Error getting checks for ${repo} ${ref}:`, error);
         return [];
    }
}

export async function getPullRequestComments(repo: string, prNumber: number): Promise<GitHubIssueComment[]> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return [];

    // Use query parameters to get the latest comments.
    // GitHub API lists comments in ascending order by default.
    // We can use per_page=100 (max) to get most, but if there are more than 100, we miss the last one.
    // A better approach to check the *last* comment is to just fetch the last page.
    // But we don't know the last page number without a HEAD request.
    // Alternatively, we can use the Issue Comments API which does NOT support sorting by creation date in the list endpoint easily (it returns in ascending order).
    // Actually, looking at GitHub API docs, `GET /repos/{owner}/{repo}/issues/{issue_number}/comments` lists comments.
    // It takes `per_page` and `page`.

    // However, since we just want to check if the *last* comment is ours,
    // and we want to avoid pagination complexity if possible.
    // But to be robust against > 30 comments (default page size), we should increase page size.
    // Even better, we can assume that if we are checking for spam loop, we only care about very recent comments.
    // Let's try to fetch with `per_page=100`. That covers 99% of cases.
    // If we want 100% robustness, we would need to follow Link headers.

    // Actually, wait. We can't sort issue comments by date DESC in the standard API?
    // The docs say "Issue comments are ordered by ascending ID."
    // So to get the last one, we really need the last page.

    // Let's implement a simple loop or just fetch the last page if Link header exists?
    // For this environment, fetching 100 comments is likely sufficient.
    const url = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100`;

    try {
         const response = await fetchWithRetry(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });

        if (!response.ok) return [];
        const comments: GitHubIssueComment[] = await response.json();

        // If we got 100 comments, there might be more.
        // We should check if there is a 'link' header indicating a next/last page.
        // But for now, 100 is a safe enough upper bound for this specific bot check to prevent spam in most realistic scenarios.
        // If a PR has > 100 comments, it's very active.
        return comments;
    } catch (error) {
        console.error(`Error getting comments for ${repo} #${prNumber}:`, error);
        return [];
    }
}

export async function createPullRequestComment(repo: string, prNumber: number, body: string): Promise<boolean> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return false;

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

        return response.ok;
    } catch (error) {
        console.error(`Error creating comment on ${repo} #${prNumber}:`, error);
        return false;
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
            console.log(`Successfully deleted branch ${branch} from ${repo}`);
            return true;
        } else if (response.status === 404) {
            // The branch is not found, so we can consider the deletion successful.
            console.warn(`Branch ${branch} not found in ${repo}, assuming it was already deleted.`);
            return true;
        } else if (response.status === 422) {
            // The branch cannot be processed, so it is a failure case.
            console.warn(`Branch ${branch} in ${repo} could not be processed.`);
            return false;
        } else {
            console.error(`Failed to delete branch ${branch} from ${repo}: ${response.status} ${response.statusText}`);
            return false;
        }
    } catch (error) {
        console.error(`Error deleting branch ${branch} from ${repo}:`, error);
        return false;
    }
}
