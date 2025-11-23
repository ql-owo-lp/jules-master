
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPullRequestStatus } from '@/app/github/actions';

// Mock next/cache
vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn) => fn),
}));

// Mocking fetch globally for all tests in this file
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GitHub Actions', () => {
  describe('getPullRequestStatus', () => {

    beforeEach(() => {
      mockFetch.mockClear();
    });

    it('should return NO_TOKEN if no token is provided', async () => {
      const status = await getPullRequestStatus('https://github.com/owner/repo/pull/123');
      expect(status?.state).toBe('NO_TOKEN');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return OPEN status for an open pull request with successful checks', async () => {
      // Mock the PR details API response
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
        state: 'open',
        merged: false,
        head: { sha: 'test-sha' }
      }), { status: 200 }));

      // Mock the check runs API response
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
        check_runs: [{ name: 'build', status: 'completed', conclusion: 'success' }]
      }), { status: 200 }));

      const status = await getPullRequestStatus('https://github.com/owner/repo/pull/123', 'dummy-token');

      expect(status?.state).toBe('OPEN');
      expect(status?.checks.status).toBe('success');
      expect(status?.checks.total).toBe(1);
      expect(status?.checks.passed).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return MERGED status for a merged pull request', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
        state: 'closed',
        merged: true,
        head: { sha: 'test-sha' }
      }), { status: 200 }));

      const status = await getPullRequestStatus('https://github.com/owner/repo/pull/123', 'dummy-token');

      expect(status?.state).toBe('MERGED');
      // No check runs should be fetched for merged PRs
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return NOT_FOUND for a non-existent pull request', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

      const status = await getPullRequestStatus('https://github.com/owner/repo/pull/404', 'dummy-token');

      expect(status?.state).toBe('NOT_FOUND');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

     it('should return UNAUTHORIZED for an unauthorized request', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

      const status = await getPullRequestStatus('https://github.com/owner/repo/pull/123', 'dummy-token');

      expect(status?.state).toBe('UNAUTHORIZED');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid PR URLs gracefully', async () => {
        const status = await getPullRequestStatus('not-a-url', 'dummy-token');
        expect(status?.state).toBe('ERROR');
        expect(mockFetch).not.toHaveBeenCalled();
    });

  });
});
