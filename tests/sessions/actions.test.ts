import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listSessions, fetchSessionsPage, listSources, cancelSessionRequest } from '@/app/sessions/actions';
import * as fetchClient from '@/lib/fetch-client';
import * as sessionService from '@/lib/session-service';

// Mock the fetch-client module
vi.mock('@/lib/fetch-client', () => ({
  fetchWithRetry: vi.fn(),
  cancelRequest: vi.fn(),
}));

// Mock the session-service module
vi.mock('@/lib/session-service', () => ({
  getCachedSessions: vi.fn(),
  upsertSession: vi.fn(),
  syncStaleSessions: vi.fn(),
  forceRefreshSession: vi.fn(),
}));

describe('Session Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MOCK_API = 'false';
    process.env.JULES_API_KEY = 'test-api-key';
  });

  describe('listSessions', () => {
    it('should return mock sessions when MOCK_API is true', async () => {
      process.env.MOCK_API = 'true';
      const result = await listSessions();
      expect(result.sessions).toBeDefined();
      expect(result.sessions.length).toBe(2);
      expect(result.sessions[0].id).toBe('session-1');
    });

    it('should return cached sessions if available', async () => {
      const mockSessions = [{ id: '1', name: 'Session 1', title: 'Title' } as any];
      (sessionService.getCachedSessions as vi.Mock).mockResolvedValue(mockSessions);

      const result = await listSessions('test-key');
      expect(result.sessions).toEqual(mockSessions);
      expect(sessionService.getCachedSessions).toHaveBeenCalled();
      expect(fetchClient.fetchWithRetry).not.toHaveBeenCalled();
    });

    it('should fetch from API if cache is empty', async () => {
       (sessionService.getCachedSessions as vi.Mock)
            .mockResolvedValueOnce([]) // First call empty
            .mockResolvedValueOnce([{ id: '1', name: 'Session 1', title: 'Title' }]); // Second call after populate

       (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [{ id: '1', name: 'Session 1', title: 'Title' }] }),
      });

      const result = await listSessions('test-key');

      // Should have called fetchSessionsPage (via logic inside listSessions)
      // fetchSessionsPage uses fetchWithRetry.
      // In listSessions, we call fetchSessionsPage with pageSize 100
      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions?pageSize=100',
        expect.any(Object)
      );

      expect(sessionService.upsertSession).toHaveBeenCalled();
      expect(result.sessions.length).toBe(1);
    });

    it('should trigger background sync', async () => {
       const mockSessions = [{ id: '1', name: 'Session 1', title: 'Title' } as any];
      (sessionService.getCachedSessions as vi.Mock).mockResolvedValue(mockSessions);

      await listSessions('test-key');
      // We can't easily await the background sync as it is not awaited in the action.
      // But we can check if it was called.
      // Actually, since it's a promise floating in the void, checking if it was called might require a small delay or just relying on the fact that the function started execution.
      // But syncStaleSessions is called synchronously (the promise creation), so the mock should record the call.

      expect(sessionService.syncStaleSessions).toHaveBeenCalledWith('test-key');
    });

    it('should return an error if no API key is provided', async () => {
      process.env.JULES_API_KEY = '';
      const result = await listSessions();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Jules API key is not configured');
      expect(result.sessions).toEqual([]);
    });

    it('should not trigger background sync on initial fetch', async () => {
      (sessionService.getCachedSessions as vi.Mock)
        .mockResolvedValueOnce([]) // First call empty
        .mockResolvedValueOnce([{ id: '1', name: 'Session 1', title: 'Title' }]); // Second call after populate

      (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: [{ id: '1', name: 'Session 1', title: 'Title' }] }),
      });

      await listSessions('test-key');

      expect(sessionService.syncStaleSessions).not.toHaveBeenCalled();
    });
  });

  describe('fetchSessionsPage', () => {
    it('should call fetchWithRetry and return a page of sessions', async () => {
      const mockSessions = [{ id: '1', name: 'Session 1' }];
      const nextPageToken = 'next-page';
      (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: mockSessions, nextPageToken }),
      });

      const result = await fetchSessionsPage('test-key', 'prev-page', 50);
      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions?pageSize=50&pageToken=prev-page',
        expect.any(Object)
      );
      expect(result.sessions).toEqual([{...mockSessions[0], createTime: expect.any(String)}]);
      expect(result.nextPageToken).toBe(nextPageToken);
    });

    it('should provide a default createTime if missing', async () => {
      const mockSessions = [{ id: '1', name: 'Session 1' }];
      (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: mockSessions }),
      });

      const result = await fetchSessionsPage('test-key');
      expect(result.sessions[0].createTime).toBeDefined();
      expect(result.sessions[0].createTime).not.toBe('');
    });
  });

  describe('listSources', () => {
    it('should paginate through all sources', async () => {
      const mockSourcesPage1 = [{ id: '1', name: 'Source 1' }];
      const mockSourcesPage2 = [{ id: '2', name: 'Source 2' }];
      (fetchClient.fetchWithRetry as vi.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: mockSourcesPage1, nextPageToken: 'next-page' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ sources: mockSourcesPage2, nextPageToken: null }),
        });

      const sources = await listSources('test-key');
      expect(fetchClient.fetchWithRetry).toHaveBeenCalledTimes(2);
      expect(sources).toEqual([...mockSourcesPage1, ...mockSourcesPage2]);
    });
  });

  describe('cancelSessionRequest', () => {
    it('should call cancelRequest with the given requestId', () => {
      const requestId = 'test-request-id';
      cancelSessionRequest(requestId);
      expect(fetchClient.cancelRequest).toHaveBeenCalledWith(requestId);
    });
  });
});
