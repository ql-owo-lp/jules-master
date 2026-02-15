
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listSessions } from './actions';
import * as sessionService from '@/lib/session-service';
import * as fetchClient from '@/lib/fetch-client';

// Mock dependencies
vi.mock('@/lib/session-service', () => ({
  getCachedSessions: vi.fn(),
  upsertSession: vi.fn(),
  syncStaleSessions: vi.fn(),
}));

vi.mock('@/lib/fetch-client', () => ({
  fetchWithRetry: vi.fn(),
  cancelRequest: vi.fn(),
}));

describe('listSessions Security Check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JULES_API_KEY = 'test-api-key';
    process.env.MOCK_API = 'false'; // Ensure we use real logic path
  });

  it('should assign profileId to sessions fetched from API during initial cache population', async () => {
    const profileId = 'secure-profile';
    const remoteSession = {
      id: 'session-123',
      name: 'sessions/session-123',
      state: 'COMPLETED',
      createTime: '2024-01-01T00:00:00Z',
      // No profileId from remote API
    };

    // 1. Mock getCachedSessions to return empty (simulating initial fetch needed)
    vi.mocked(sessionService.getCachedSessions).mockResolvedValue([]);

    // 2. Mock fetchWithRetry to return remote session
    vi.mocked(fetchClient.fetchWithRetry).mockResolvedValue({
      ok: true,
      json: async () => ({
        sessions: [remoteSession],
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // 3. Call listSessions
    await listSessions('test-key', 50, 'req-id', profileId);

    // 4. Verify upsertSession was called with profileId set
    // This assertion will fail if the bug is present
    expect(sessionService.upsertSession).toHaveBeenCalledWith(expect.objectContaining({
      id: 'session-123',
      profileId: profileId,
    }));
  });
});
