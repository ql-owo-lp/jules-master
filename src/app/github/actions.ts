
'use server';

import type { GitHubPullRequest, PullRequestStatus } from '@/lib/types';
import { unstable_cache } from 'next/cache';

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


// This function is cached to avoid hitting the GitHub API too frequently for the same PR.
// The cache is invalidated based on a revalidation time or when the underlying data changes.
const getPullRequestStatusFromApi = unstable_cache(
  async (prUrl: string, token: string): Promise<PullRequestStatus | null> => {
    
    if (!token) {
      return { state: 'NO_TOKEN', checks: 'unknown' };
    }

    const prInfo = parsePrUrl(prUrl);
    if (!prInfo) {
      console.error('Could not parse PR URL:', prUrl);
      return { state: 'ERROR', checks: 'unknown' };
    }

    const { owner, repo, pull_number } = prInfo;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}`;

    try {
      const prResponse = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!prResponse.ok) {
        if (prResponse.status === 404) {
            console.warn(`Pull request not found: ${apiUrl}`);
            return { state: 'NOT_FOUND', checks: 'unknown' };
        }
         if (prResponse.status === 401) {
            console.warn(`Unauthorized access to GitHub API. Check token.`);
            return { state: 'UNAUTHORIZED', checks: 'unknown' };
        }
        console.error(`GitHub API error for PR details: ${prResponse.status} ${prResponse.statusText}`);
        return { state: 'ERROR', checks: 'unknown' };
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
      let checks: 'pending' | 'success' | 'failure' | 'unknown' = 'unknown';
      if (state === 'OPEN' && prData.head.sha) {
        const statusUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${prData.head.sha}/status`;
        const statusResponse = await fetch(statusUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.state === 'pending' || statusData.state === 'success' || statusData.state === 'failure') {
            checks = statusData.state;
          }
        } else {
             console.warn(`Could not fetch CI status for ${prData.head.sha}: ${statusResponse.status}`);
        }
      }

      return { state, checks };

    } catch (error) {
      console.error('Error fetching pull request status:', error);
      return { state: 'ERROR', checks: 'unknown' };
    }
  },
  ['pull-request-status'], // Cache key prefix
  {
    revalidate: 60, // Revalidate every 60 seconds
    tags: ['github-pr-status'],
  }
);


export async function getPullRequestStatus(prUrl: string, token: string): Promise<PullRequestStatus | null> {
    return getPullRequestStatusFromApi(prUrl, token);
}
