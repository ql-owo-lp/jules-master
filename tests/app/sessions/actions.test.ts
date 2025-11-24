
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fetchClient from '@/lib/fetch-client';
import {
  listSessions,
  fetchSessionsPage,
  listSources,
  revalidateSessions,
  cancelSessionRequest,
} from '@/app/sessions/actions';

// Mock revalidateTag from next/cache
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

// Mock fetch-client
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
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session-1');
    });

    it('should return empty array if no API key is provided', async () => {
      delete process.env.JULES_API_KEY;
      const sessions = await listSessions();
      expect(sessions).toEqual([]);
    });

    it('should fetch sessions from the API', async () => {
      const mockSessions = [{ id: '1', name: 'Session 1' }];
      (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ sessions: mockSessions }),
      });

      const sessions = await listSessions();
      expect(sessions).toEqual(mockSessions.map(s => ({ ...s, createTime: '' })));
      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions?pageSize=50',
        expect.any(Object)
      );
    });
  });

  describe('fetchSessionsPage', () => {
    it('should return mock sessions when MOCK_API is true', async () => {
        process.env.MOCK_API = 'true';
        const result = await fetchSessionsPage();
        expect(result.sessions).toHaveLength(2);
    });

    it('should return empty array if no API key is provided', async () => {
        delete process.env.JULES_API_KEY;
        const result = await fetchSessionsPage();
        expect(result.sessions).toEqual([]);
    });

    it('should fetch a page of sessions from the API', async () => {
        const mockSessions = [{ id: '1', name: 'Session 1' }];
        const nextPageToken = 'next-page';
        (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ sessions: mockSessions, nextPageToken }),
        });

        const result = await fetchSessionsPage();
        expect(result.sessions).toEqual(mockSessions.map(s => ({ ...s, createTime: '' })));
        expect(result.nextPageToken).toBe(nextPageToken);
    });
  });

  describe('listSources', () => {
    it('should return mock sources when MOCK_API is true', async () => {
        process.env.MOCK_API = 'true';
        const sources = await listSources();
        expect(sources).toHaveLength(1);
        expect(sources[0].id).toBe('source-1');
    });

    it('should return empty array if no API key is provided', async () => {
        delete process.env.JULES_API_KEY;
        const sources = await listSources();
        expect(sources).toEqual([]);
    });

    it('should fetch all sources from the API', async () => {
        const mockSources = [{ id: '1', name: 'Source 1' }];
        (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ sources: mockSources, nextPageToken: 'next-page' }),
        }).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ sources: mockSources }),
        });

        const sources = await listSources();
        expect(sources).toHaveLength(2);
    });
  });

  describe('revalidateSessions', () => {
    it('should call revalidateTag with "sessions"', async () => {
      const { revalidateTag } = await import('next/cache');
      await revalidateSessions();
      expect(revalidateTag).toHaveBeenCalledWith('sessions');
    });
  });

  describe('cancelSessionRequest', () => {
    it('should call cancelRequest with the provided requestId', () => {
      const requestId = 'test-request-id';
      cancelSessionRequest(requestId);
      expect(fetchClient.cancelRequest).toHaveBeenCalledWith(requestId);
    });
  });
});
