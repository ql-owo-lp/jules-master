
import { describe, it, expect, vi, beforeEach } from 'vitest';
import createFetchMock from 'vitest-fetch-mock';
import { revalidatePath } from 'next/cache';

import {
  getSession,
  listActivities,
  approvePlan,
  sendMessage,
} from '@/app/sessions/[id]/actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const fetchMocker = createFetchMock(vi);

describe('Session ID Actions', () => {
  beforeEach(() => {
    fetchMocker.enableMocks();
    fetchMocker.resetMocks();
    process.env.JULES_API_KEY = 'test-api-key';
  });

  describe('getSession', () => {
    it('should return a session on successful API call', async () => {
      const mockSession = { id: '1', name: 'Session 1' };
      fetchMocker.mockResponseOnce(JSON.stringify(mockSession));

      const session = await getSession('1');
      expect(session).toEqual(mockSession);
    });

    it('should return null if the session is not found', async () => {
      fetchMocker.mockResponseOnce('Not Found', { status: 404 });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const session = await getSession('not-found');
      expect(session).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should return null if API key is missing', async () => {
      process.env.JULES_API_KEY = '';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const session = await getSession('1');
      expect(session).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Jules API key is not configured.');
    });
  });

  describe('listActivities', () => {
    it('should return a list of activities on successful API call', async () => {
      const mockActivities = [{ id: '1', name: 'Activity 1' }];
      fetchMocker.mockResponseOnce(JSON.stringify({ activities: mockActivities }));

      const activities = await listActivities('1');
      expect(activities).toEqual(mockActivities);
    });

    it('should return an empty list when the API returns no activities', async () => {
      fetchMocker.mockResponseOnce(JSON.stringify({ activities: [] }));

      const activities = await listActivities('1');
      expect(activities).toEqual([]);
    });

    it('should return an empty list on API failure', async () => {
      fetchMocker.mockResponseOnce('Server Error', { status: 500 });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const activities = await listActivities('1');
      expect(activities).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('approvePlan', () => {
    it('should return the updated session on successful plan approval', async () => {
      const mockSession = { id: '1', name: 'Session 1', state: 'PLAN_APPROVED' };
      fetchMocker.mockResponseOnce(JSON.stringify(mockSession));

      const session = await approvePlan('1');
      expect(session).toEqual(mockSession);
      expect(fetchMocker.mock.calls[0][1]?.method).toBe('POST');
      expect(revalidatePath).toHaveBeenCalledWith('/sessions/1');
      expect(revalidatePath).toHaveBeenCalledWith('/');
    });

    it('should return null on API failure', async () => {
      fetchMocker.mockResponseOnce('Server Error', { status: 500 });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const session = await approvePlan('1');
      expect(session).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should return the updated session on successful message send', async () => {
      const mockSession = { id: '1', name: 'Session 1', state: 'AWAITING_USER_FEEDBACK' };
      fetchMocker.mockResponseOnce(JSON.stringify(mockSession));

      const session = await sendMessage('1', 'Test message');
      expect(session).toEqual(mockSession);
      expect(fetchMocker.mock.calls[0][1]?.method).toBe('POST');
      expect(fetchMocker.mock.calls[0][1]?.body).toBe(JSON.stringify({ prompt: 'Test message' }));
      expect(revalidatePath).toHaveBeenCalledWith('/sessions/1');
      expect(revalidatePath).toHaveBeenCalledWith('/');
    });

    it('should return null on API failure', async () => {
      fetchMocker.mockResponseOnce('Server Error', { status: 500 });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const session = await sendMessage('1', 'Test message');
      expect(session).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
