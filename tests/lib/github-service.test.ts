
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { deleteBranch } from '../../src/lib/github-service';
import * as fetchClient from '../../src/lib/fetch-client';

describe('deleteBranch', () => {
  beforeEach(() => {
    vi.stubEnv('GITHUB_TOKEN', 'test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('should return true when the branch is already deleted', async () => {
    const fetchWithRetrySpy = vi.spyOn(fetchClient, 'fetchWithRetry').mockResolvedValue(
      new Response(null, { status: 404 })
    );

    const result = await deleteBranch('test-repo', 'test-branch');

    expect(result).toBe(true);
    expect(fetchWithRetrySpy).toHaveBeenCalledWith(
      'https://api.github.com/repos/test-repo/git/refs/heads/test-branch',
      expect.any(Object)
    );
  });
});
