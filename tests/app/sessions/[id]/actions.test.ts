
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fetchClient from '@/lib/fetch-client';
import {
  getSession,
  listActivities,
  approvePlan,
  sendMessage,
} from '@/app/sessions/[id]/actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/fetch-client', () => ({
  fetchWithRetry: vi.fn(),
}));

describe('Session [id] Actions', () => {
  const sessionId = 'test-session-id';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JULES_API_KEY = 'test-api-key';
  });

  describe('getSession', () => {
    it('should return null if no API key is provided', async () => {
      delete process.env.JULES_API_KEY;
      const session = await getSession(sessionId);
      expect(session).toBeNull();
    });

    it('should fetch a session from the API', async () => {
      const mockSession = { id: sessionId, name: 'Test Session' };
      (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSession),
      });

      const session = await getSession(sessionId);
      expect(session).toEqual(mockSession);
      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        `https://jules.googleapis.com/v1alpha/sessions/${sessionId}`,
        expect.any(Object)
      );
    });
  });

  describe('listActivities', () => {
    it('should return empty array if no API key is provided', async () => {
        delete process.env.JULES_API_KEY;
        const activities = await listActivities(sessionId);
        expect(activities).toEqual([]);
    });

    it('should fetch activities from the API', async () => {
        const mockActivities = [{ id: '1', name: 'Activity 1' }];
        (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ activities: mockActivities }),
        });

        const activities = await listActivities(sessionId);
        expect(activities).toEqual(mockActivities);
    });
  });

  describe('approvePlan', () => {
    it('should return null if no API key is provided', async () => {
        delete process.env.JULES_API_KEY;
        const result = await approvePlan(sessionId);
        expect(result).toBeNull();
    });

    it('should approve a plan and return the updated session', async () => {
        const mockSession = { id: sessionId, name: 'Test Session' };
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockSession),
        });

        const result = await approvePlan(sessionId);
        expect(result).toEqual(mockSession);
    });
  });

  describe('sendMessage', () => {
    it('should return null if no API key is provided', async () => {
        delete process.env.JULES_API_KEY;
        const result = await sendMessage(sessionId, 'Test message');
        expect(result).toBeNull();
    });

    it('should send a message and return the updated session', async () => {
        const mockSession = { id: sessionId, name: 'Test Session' };
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockSession),
        });

        const result = await sendMessage(sessionId, 'Test message');
        expect(result).toEqual(mockSession);
    });
  });
});
