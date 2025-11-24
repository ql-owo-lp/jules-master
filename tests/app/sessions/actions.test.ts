
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  listSessions,
  fetchSessionsPage,
  listSources,
  cancelSessionRequest,
  revalidateSessions,
  refreshSources,
} from '@/app/sessions/actions';
import * as fetchClient from '@/lib/fetch-client';

vi.mock('@/lib/fetch-client', () => ({
  fetchWithRetry: vi.fn(),
  cancelRequest: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

describe('Session Actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.MOCK_API = 'false';
    process.env.JULES_API_KEY = 'test-api-key';
  });

  describe('listSessions', () => {
    it('should return mock sessions when MOCK_API is true', async () => {
      process.env.MOCK_API = 'true';
      const sessions = await listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session-1');
    });

    it('should call fetchWithRetry and return sessions on success', async () => {
      const mockSessions = [{ id: '1', name: 'Session 1' }];
      const mockResponse = {
        ok: true,
        json: async () => ({ sessions: mockSessions }),
      };
      vi.mocked(fetchClient.fetchWithRetry).mockResolvedValue(mockResponse as any);

      const sessions = await listSessions();

      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions?pageSize=50',
        expect.any(Object)
      );
      expect(sessions).toEqual(mockSessions.map(s => ({ ...s, createTime: '' })));
    });

    it('should return an empty array if the API key is missing', async () => {
      delete process.env.JULES_API_KEY;
      const sessions = await listSessions();
      expect(sessions).toEqual([]);
      expect(fetchClient.fetchWithRetry).not.toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      vi.mocked(fetchClient.fetchWithRetry).mockRejectedValue(new Error('Network error'));
      const sessions = await listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('fetchSessionsPage', () => {
    it('should return mock sessions when MOCK_API is true', async () => {
        process.env.MOCK_API = 'true';
        const result = await fetchSessionsPage();
        expect(result.sessions).toHaveLength(2);
        expect(result.sessions[0].id).toBe('session-1');
        expect(result.nextPageToken).toBeUndefined();
    });

    it('should call fetchWithRetry and return sessions and a next page token', async () => {
        const mockSessions = [{ id: '1', name: 'Session 1' }];
        const mockResponse = {
            ok: true,
            json: async () => ({ sessions: mockSessions, nextPageToken: 'next-page' }),
        };
        vi.mocked(fetchClient.fetchWithRetry).mockResolvedValue(mockResponse as any);

        const result = await fetchSessionsPage();
        expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
            'https://jules.googleapis.com/v1alpha/sessions?pageSize=100',
            expect.any(Object)
        );
        expect(result.sessions).toEqual(mockSessions.map(s => ({ ...s, createTime: '' })));
        expect(result.nextPageToken).toBe('next-page');
    });

    it('should include the page token in the request', async () => {
        vi.mocked(fetchClient.fetchWithRetry).mockResolvedValue({
            ok: true,
            json: async () => ({ sessions: [] }),
        } as any);
        await fetchSessionsPage('test-api-key', 'page-token');
        expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
            'https://jules.googleapis.com/v1alpha/sessions?pageSize=100&pageToken=page-token',
            expect.any(Object)
        );
    });
  });

  describe('listSources', () => {
    it('should return mock sources when MOCK_API is true', async () => {
        process.env.MOCK_API = 'true';
        const sources = await listSources();
        expect(sources).toHaveLength(1);
        expect(sources[0].id).toBe('source-1');
    });

    it('should paginate through all sources', async () => {
        const mockResponse1 = {
            ok: true,
            json: async () => ({
                sources: [{ id: '1', name: 'Source 1' }],
                nextPageToken: 'next-page',
            }),
        };
        const mockResponse2 = {
            ok: true,
            json: async () => ({
                sources: [{ id: '2', name: 'Source 2' }],
            }),
        };
        vi.mocked(fetchClient.fetchWithRetry)
            .mockResolvedValueOnce(mockResponse1 as any)
            .mockResolvedValueOnce(mockResponse2 as any);

        const sources = await listSources();
        expect(sources).toHaveLength(2);
        expect(sources[0].id).toBe('1');
        expect(sources[1].id).toBe('2');
    });
  });

  describe('cancelSessionRequest', () => {
    it('should call cancelRequest with the provided request ID', () => {
        cancelSessionRequest('request-123');
        expect(fetchClient.cancelRequest).toHaveBeenCalledWith('request-123');
    });
  });

  describe('revalidateSessions', () => {
    it('should call revalidateTag with "sessions"', async () => {
        const { revalidateTag } = await import('next/cache');
        await revalidateSessions();
        expect(revalidateTag).toHaveBeenCalledWith('sessions');
    });
  });

  describe('refreshSources', () => {
    it('should call revalidateTag with "sources"', async () => {
        const { revalidateTag } = await import('next/cache');
        await refreshSources();
        expect(revalidateTag).toHaveBeenCalledWith('sources');
    });
  });
});
