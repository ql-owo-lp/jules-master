
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { sendMessage } from '@/app/sessions/[id]/actions';
import * as fetchClient from '@/lib/fetch-client';

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock the fetch-client
vi.mock('@/lib/fetch-client', () => ({
  fetchWithRetry: vi.fn(),
}));

// Mock the db
const { mockSelect, mockUpdate, mockGet } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockWhere = vi.fn().mockReturnValue({ get: mockGet });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) });
  return { mockSelect, mockUpdate, mockGet };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

vi.mock('@/lib/session-service', () => ({
    updateSessionInteraction: vi.fn(),
}));

describe('Session Details Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JULES_API_KEY = 'test-key';
  });

  describe('sendMessage', () => {
    it('should throw an error if lastInteractionAt is within 1 second', async () => {
      const sessionId = 'session-1';
      const message = 'Hello';
      const recentTime = Date.now() - 500; // 500ms ago

      // Mock DB to return a recent interaction
      mockGet.mockResolvedValue({ lastInteractionAt: recentTime });

      await expect(sendMessage(sessionId, message)).rejects.toThrow('Rate limit exceeded');
      expect(fetchClient.fetchWithRetry).not.toHaveBeenCalled();
    });

    it('should allow sending a message if lastInteractionAt is older than 1 second', async () => {
      const sessionId = 'session-1';
      const message = 'Hello';
      const oldTime = Date.now() - 1500; // 1.5s ago

      // Mock DB to return an old interaction
      mockGet.mockResolvedValue({ lastInteractionAt: oldTime });

      // Mock API success
      (fetchClient.fetchWithRetry as Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ id: sessionId, messages: [] }),
      });

      const result = await sendMessage(sessionId, message);

      expect(result).toBeDefined();
      expect(fetchClient.fetchWithRetry).toHaveBeenCalled();
    });
  });
});
