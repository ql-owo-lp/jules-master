
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listSessions, fetchSessionsPage, listSources, cancelSessionRequest } from '@/app/sessions/actions';
import * as fetchClient from '@/lib/fetch-client';

// Mock the fetch-client module
vi.mock('@/lib/fetch-client', () => ({
  fetchWithRetry: vi.fn(),
  cancelRequest: vi.fn(),
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
      const sessions = await listSessions();
      expect(sessions).toBeDefined();
      expect(sessions.length).toBe(2);
      expect(sessions[0].id).toBe('session-1');
    });

    it('should call fetchWithRetry and return sessions', async () => {
      const mockSessions = [{ id: '1', name: 'Session 1' }];
      (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ sessions: mockSessions }),
      });

      const sessions = await listSessions('test-key');
      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions?pageSize=50',
        expect.any(Object)
      );
      expect(sessions).toEqual(mockSessions.map(s => ({ ...s, createTime: '' })));
    });

    it('should handle API errors gracefully', async () => {
      (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: async () => 'Error details',
      });

      const sessions = await listSessions('test-key');
      expect(sessions).toEqual([]);
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
      expect(result.sessions).toEqual(mockSessions.map(s => ({ ...s, createTime: '' })));
      expect(result.nextPageToken).toBe(nextPageToken);
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
