
import { describe, it, expect, vi, beforeEach } from 'vitest';
import createFetchMock from 'vitest-fetch-mock';
import { revalidatePath } from 'next/cache';

import {
  listSessions,
  fetchSessionsPage,
  listSources,
} from '@/app/sessions/actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const fetchMocker = createFetchMock(vi);

describe('Session Actions', () => {
  beforeEach(() => {
    fetchMocker.enableMocks();
    fetchMocker.resetMocks();
    process.env.JULES_API_KEY = 'test-api-key';
  });

  describe('listSessions', () => {
    it('should return a list of sessions on successful API call', async () => {
      const mockSessions = [{ id: '1', name: 'Session 1' }];
      fetchMocker.mockResponseOnce(JSON.stringify({ sessions: mockSessions }));

      const sessions = await listSessions();
      expect(sessions).toEqual(mockSessions.map(s => ({ ...s, createTime: '' })));
      expect(fetchMocker.mock.calls.length).toEqual(1);
    });

    it('should return an empty list when the API returns no sessions', async () => {
      fetchMocker.mockResponseOnce(JSON.stringify({ sessions: [] }));

      const sessions = await listSessions();
      expect(sessions).toEqual([]);
    });

    it('should return an empty list and log an error on API failure', async () => {
      fetchMocker.mockResponseOnce('Server Error', { status: 500 });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const sessions = await listSessions();
      expect(sessions).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return an empty list if API key is missing', async () => {
      process.env.JULES_API_KEY = '';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const sessions = await listSessions();
      expect(sessions).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Jules API key is not configured.');
    });
  });

  describe('fetchSessionsPage', () => {
    it('should fetch a page of sessions', async () => {
      const mockSessions = [{ id: '1', name: 'Session 1' }];
      const nextPageToken = 'next-page-token';
      fetchMocker.mockResponseOnce(JSON.stringify({ sessions: mockSessions, nextPageToken }));

      const result = await fetchSessionsPage();
      expect(result.sessions).toEqual(mockSessions.map(s => ({ ...s, createTime: '' })));
      expect(result.nextPageToken).toBe(nextPageToken);
    });

    it('should include pageToken in the request', async () => {
      const pageToken = 'test-page-token';
      fetchMocker.mockResponseOnce(JSON.stringify({ sessions: [] }));

      await fetchSessionsPage(undefined, pageToken);
      expect(fetchMocker.mock.calls[0][0]).toContain(`pageToken=${pageToken}`);
    });

    it('should return an empty list and log error on API failure', async () => {
      fetchMocker.mockResponseOnce('Server Error', { status: 500 });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await fetchSessionsPage();
      expect(result.sessions).toEqual([]);
      expect(result.nextPageToken).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return an empty list if API key is missing', async () => {
      process.env.JULES_API_KEY = '';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await fetchSessionsPage();
      expect(result.sessions).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Jules API key is not configured.');
    });
  });

  describe('listSources', () => {
    it('should return a list of sources with pagination', async () => {
      const mockSources1 = [{ id: '1', name: 'Source 1' }];
      const mockSources2 = [{ id: '2', name: 'Source 2' }];
      fetchMocker
        .mockResponseOnce(JSON.stringify({ sources: mockSources1, nextPageToken: 'next-page' }))
        .mockResponseOnce(JSON.stringify({ sources: mockSources2 }));

      const sources = await listSources();
      expect(sources).toEqual([...mockSources1, ...mockSources2]);
      expect(fetchMocker.mock.calls.length).toEqual(2);
    });

    it('should return an empty list on API failure', async () => {
      fetchMocker.mockResponseOnce('Server Error', { status: 500 });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const sources = await listSources();
      expect(sources).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
