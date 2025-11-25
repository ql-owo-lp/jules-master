
'use server';

import type { GitHubPullRequest, PullRequestStatus, CheckRun } from '@/lib/types';
import { unstable_cache } from 'next/cache';

// Adding a type for the simplified check run information
type SimpleCheckRun = {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out" | "action_required" | null;
};

// Function to parse owner, repo, and pull number from a GitHub PR URL
const parsePrUrl = (url: string) => {
  try {
    const urlObject = new URL(url);
    const parts = urlObject.pathname.split('/');
    // Example path: /owner/repo/pull/123
    if (parts.length >= 5 && parts[3] === 'pull') {
      return {
        owner: parts[1],
        repo: parts[2],
        pull_number: parseInt(parts[4], 10),
      };
    }
  } catch (e) {
    console.error('Invalid PR URL', url);
  }
  return null;
};

const unknownChecks = { status: 'unknown' as const, total: 0, passed: 0, runs: [] as SimpleCheckRun[] };

// This function is cached to avoid hitting the GitHub API too frequently for the same PR.
// The cache is invalidated based on a revalidation time or when the underlying data changes.
const getPullRequestStatusFromApi = unstable_cache(
  async (prUrl: string, token?: string | null): Promise<PullRequestStatus | null> => {
    
    const effectiveToken = token || process.env.GITHUB_TOKEN;

    if (!effectiveToken) {
      return { state: 'NO_TOKEN', checks: unknownChecks };
    }

    const prInfo = parsePrUrl(prUrl);
    if (!prInfo) {
      console.error('Could not parse PR URL:', prUrl);
      return { state: 'ERROR', checks: unknownChecks };
    }

    const { owner, repo, pull_number } = prInfo;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}`;

    try {
      const prResponse = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${effectiveToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!prResponse.ok) {
        if (prResponse.status === 404) {
            console.warn(`Pull request not found: ${apiUrl}`);
            return { state: 'NOT_FOUND', checks: unknownChecks };
        }
         if (prResponse.status === 401) {
            console.warn(`Unauthorized access to GitHub API. Check token.`);
            return { state: 'UNAUTHORIZED', checks: unknownChecks };
        }
        console.error(`GitHub API error for PR details: ${prResponse.status} ${prResponse.statusText}`);
        return { state: 'ERROR', checks: unknownChecks };
      }

      const prData: GitHubPullRequest = await prResponse.json();

      // Determine PR state
      let state: 'OPEN' | 'MERGED' | 'CLOSED' = 'CLOSED';
      if (prData.merged) {
        state = 'MERGED';
      } else if (prData.state === 'open') {
        state = 'OPEN';
      }

      // If not merged, get the CI check status for the head SHA
      let checks: {
        status: 'unknown' | 'success' | 'failure' | 'pending';
        total: number;
        passed: number;
        runs: SimpleCheckRun[];
      } = { ...unknownChecks };
      if (state === 'OPEN' && prData.head.sha) {
        const checkRunsUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${prData.head.sha}/check-runs`;
        const checkRunsResponse = await fetch(checkRunsUrl, {
          headers: {
            Authorization: `Bearer ${effectiveToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        
        if (checkRunsResponse.ok) {
          const checkRunsData: { check_runs: CheckRun[] } = await checkRunsResponse.json();
          const runs = checkRunsData.check_runs;
          const total = runs.length;
          const passed = runs.filter(run => run.conclusion === 'success').length;
          const failed = runs.some(run => run.conclusion === 'failure' || run.conclusion === 'timed_out');
          const pending = runs.some(run => run.status !== 'completed');

          checks.total = total;
          checks.passed = passed;
          checks.runs = runs.map(r => ({ name: r.name, status: r.status, conclusion: r.conclusion }));
          
          if (total === 0) {
             checks.status = 'unknown';
          } else if (pending) {
            checks.status = 'pending';
          } else if (failed) {
            checks.status = 'failure';
          } else {
            checks.status = 'success';
          }
        } else {
             console.warn(`Could not fetch CI checks for ${prData.head.sha}: ${checkRunsResponse.status}`);
        }
      }

      return { state, checks, merged_at: prData.merged_at };

    } catch (error) {
      console.error('Error fetching pull request status:', error);
      return { state: 'ERROR', checks: unknownChecks };
    }
  },
  ['pull-request-status'], // Cache key prefix
  {
    revalidate: 60, // Revalidate every 60 seconds
    tags: ['github-pr-status'],
  }
);


export async function getPullRequestStatus(prUrl: string, token?: string | null): Promise<PullRequestStatus | null> {
    return getPullRequestStatusFromApi(prUrl, token);
}
