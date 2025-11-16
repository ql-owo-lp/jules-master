
'use server';

export type PRStatus = {
  state: 'OPEN' | 'CLOSED' | 'MERGED' | 'UNKNOWN';
  ciStatus: 'SUCCESS' | 'PENDING' | 'FAILURE' | 'NONE' | 'UNKNOWN';
};

export async function getPullRequestStatus(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string
): Promise<PRStatus> {
  if (!token) {
    return { state: 'UNKNOWN', ciStatus: 'UNKNOWN' };
  }

  try {
    const prResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        // Revalidate frequently as status can change
        next: { revalidate: 60 },
      }
    );

    if (!prResponse.ok) {
      console.error(`Failed to fetch PR: ${prResponse.status}`);
      // If PR not found, it might be an error or just not created yet.
      // We can return UNKNOWN and let the UI handle it.
      if (prResponse.status === 404) {
        return { state: 'UNKNOWN', ciStatus: 'UNKNOWN' };
      }
      // For other errors, we can be more explicit if needed, but for now, this is fine.
       return { state: 'UNKNOWN', ciStatus: 'FAILURE' };
    }

    const prData = await prResponse.json();

    let state: PRStatus['state'] = 'UNKNOWN';
    if (prData.merged) {
      state = 'MERGED';
    } else if (prData.state === 'closed') {
      state = 'CLOSED';
    } else if (prData.state === 'open') {
      state = 'OPEN';
    }

    // If the PR is merged or closed, we might not need to check CI status,
    // but for completeness, we can check the status of the last commit.
    const headSha = prData.head.sha;

    const checksResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${headSha}/check-runs`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        next: { revalidate: 60 },
      }
    );
    
    if (!checksResponse.ok) {
      console.error(`Failed to fetch check runs: ${checksResponse.status}`);
      return { state, ciStatus: 'UNKNOWN' };
    }

    const checksData = await checksResponse.json();

    if (checksData.total_count === 0) {
      return { state, ciStatus: 'NONE' };
    }

    const conclusions = new Set(checksData.check_runs.map((run: any) => run.conclusion || 'pending'));

    let ciStatus: PRStatus['ciStatus'] = 'UNKNOWN';

    if (conclusions.has('failure') || conclusions.has('timed_out') || conclusions.has('cancelled')) {
      ciStatus = 'FAILURE';
    } else if (conclusions.has('pending') || checksData.check_runs.some((run: any) => run.status !== 'completed')) {
      ciStatus = 'PENDING';
    } else if (Array.from(conclusions).every(c => c === 'success' || c === 'skipped' || c === 'neutral')) {
      ciStatus = 'SUCCESS';
    }
    
    return { state, ciStatus };

  } catch (error) {
    console.error('Error fetching PR status:', error);
    return { state: 'UNKNOWN', ciStatus: 'UNKNOWN' };
  }
}
