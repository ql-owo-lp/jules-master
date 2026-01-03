
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { getSession, listActivities, approvePlan, sendMessage } from '@/app/sessions/[id]/actions';
import * as fetchClient from '@/lib/fetch-client';

// Mock the fetch-client module
vi.mock('@/lib/fetch-client', () => ({
  fetchWithRetry: vi.fn(),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Session [id] Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JULES_API_KEY = 'test-api-key';
  });

  describe('getSession', () => {
    it('should return a session on successful fetch', async () => {
      const mockSession = { id: '123', name: 'Test Session' };
      (fetchClient.fetchWithRetry as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      });

      const session = await getSession('123');
      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions/123',
        expect.any(Object)
      );
      expect(session).toEqual(mockSession);
    });

    it('should return null if API key is missing', async () => {
      process.env.JULES_API_KEY = '';
      const session = await getSession('123');
      expect(session).toBeNull();
    });
  });

  describe('listActivities', () => {
    it('should return a list of activities', async () => {
      const mockActivities = [{ id: 'act1', description: 'Activity 1' }];
      (fetchClient.fetchWithRetry as Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ activities: mockActivities }),
      });

      const activities = await listActivities('123');
      expect(activities).toEqual(mockActivities);
    });
  });

  describe('approvePlan', () => {
    it('should approve a plan and return the updated session', async () => {
      const mockSession = { id: '123', status: 'PLAN_APPROVED' };
      (fetchClient.fetchWithRetry as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      });

      const session = await approvePlan('123');
      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions/123:approvePlan',
        expect.any(Object)
      );
      expect(session).toEqual(mockSession);
    });
  });

  describe('sendMessage', () => {
    it('should send a message and return the updated session', async () => {
      const mockSession = { id: '123', status: 'AWAITING_USER_INPUT' };
      (fetchClient.fetchWithRetry as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      });

      const session = await sendMessage('123', 'Hello');
      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions/123:sendMessage',
        expect.any(Object)
      );
      expect(session).toEqual(mockSession);
    });
  });
});
