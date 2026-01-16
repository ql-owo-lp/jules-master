
import { describe, it, expect, vi } from 'vitest';
import { createSession } from '../../src/app/sessions/new/actions';
import * as fetchClient from '../../src/lib/fetch-client';

describe('createSession', () => {
  it('should populate id from name if id is missing', async () => {
    // Mock fetchWithRetry
    vi.spyOn(fetchClient, 'fetchWithRetry').mockResolvedValue({
      ok: true,
      json: async () => ({
        name: 'sessions/12345',
        title: 'New Session',
        // id is intentionally missing
      }),
      text: async () => '',
    } as Response);

    const session = await createSession({
      prompt: 'test',
      sourceContext: {
          source: 'sources/github/owner/repo',
          githubRepoContext: { startingBranch: 'main' }
      }
    }, 'api-key');

    expect(session).not.toBeNull();
    expect(session?.id).toBe('12345');
  });
});
