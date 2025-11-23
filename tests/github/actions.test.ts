
import { describe, it, expect, vi } from 'vitest';
import { getPullRequestStatus } from '@/app/github/actions';

vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn) => fn),
}));

describe('getPullRequestStatus', () => {
    it('should return NO_TOKEN if no token is provided', async () => {
      const result = await getPullRequestStatus('https://github.com/owner/repo/pull/1');
      expect(result?.state).toBe('NO_TOKEN');
    });

    it('should return ERROR if the PR URL is invalid', async () => {
      const result = await getPullRequestStatus('invalid-url', 'test-token');
      expect(result?.state).toBe('ERROR');
    });

    it('should return NOT_FOUND if the PR is not found', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));
      const result = await getPullRequestStatus('https://github.com/owner/repo/pull/1', 'test-token');
      expect(result?.state).toBe('NOT_FOUND');
    });

    it('should return UNAUTHORIZED if the token is invalid', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 401 }));
      const result = await getPullRequestStatus('https://github.com/owner/repo/pull/1', 'test-token');
      expect(result?.state).toBe('UNAUTHORIZED');
    });

    it('should return the correct status for an open PR with successful checks', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
          state: 'open',
          merged: false,
          head: { sha: 'test-sha' },
        }), { status: 200 }));
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
          check_runs: [{ conclusion: 'success', status: 'completed' }],
        }), { status: 200 }));

        const result = await getPullRequestStatus('https://github.com/owner/repo/pull/1', 'test-token');
        expect(result?.state).toBe('OPEN');
        expect(result?.checks.status).toBe('success');
      });
  });
