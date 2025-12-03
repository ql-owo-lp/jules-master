
'use server';

import { fetchWithRetry } from './fetch-client';

export async function deleteBranch(repo: string, branch: string): Promise<boolean> {
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
        } else if (response.status === 404 || response.status === 422) {
            console.warn(`Branch ${branch} not found in ${repo}, assuming it was already deleted.`);
            return true;
        } else {
            console.error(`Failed to delete branch ${branch} from ${repo}: ${response.status} ${response.statusText}`);
            return false;
        }
    } catch (error) {
        console.error(`Error deleting branch ${branch} from ${repo}:`, error);
        return false;
    }
}
