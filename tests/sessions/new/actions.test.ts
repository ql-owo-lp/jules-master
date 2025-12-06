
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession } from '@/app/sessions/new/actions';
import * as fetchClient from '@/lib/fetch-client';

// Mock the fetch-client module
vi.mock('@/lib/fetch-client', () => ({
  fetchWithRetry: vi.fn(),
}));

describe('Session New Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JULES_API_KEY = 'test-api-key';
  });

  describe('createSession', () => {
    const sessionData = {
      prompt: 'Test prompt',
      sourceContext: { source: 'sources/github/owner/repo' },
      title: 'Test Session',
      requirePlanApproval: true,
    };

    it('should create a session and return it', async () => {
      const mockSession = { id: 'new-session', ...sessionData };
      (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      });

      const session = await createSession(sessionData);
      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(sessionData),
        })
      );
      expect(session).toEqual(mockSession);
    });

    it('should not include requirePlanApproval if it is false', async () => {
      const sessionDataWithoutApproval = { ...sessionData, requirePlanApproval: false };
      const mockSession = { id: 'new-session', ...sessionDataWithoutApproval };
      (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      });

      await createSession(sessionDataWithoutApproval);
      const expectedBody = { ...sessionDataWithoutApproval };
      delete expectedBody.requirePlanApproval;

      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions',
        expect.objectContaining({
          body: JSON.stringify(expectedBody),
        })
      );
    });

    it('should return null if API key is missing', async () => {
      process.env.JULES_API_KEY = '';
      const session = await createSession(sessionData);
      expect(session).toBeNull();
    });

    it('should return null on API error', async () => {
      (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: async () => 'Error',
      });

      const session = await createSession(sessionData);
      expect(session).toBeNull();
    });

    it('should not include autoRetryEnabled and autoContinueEnabled even if they are true', async () => {
        const sessionDataWithFlags = { ...sessionData, autoRetryEnabled: true, autoContinueEnabled: true };
        const mockSession = { id: 'new-session', ...sessionDataWithFlags };
        (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
            ok: true,
            json: async () => mockSession,
        });

        await createSession(sessionDataWithFlags);
        const expectedBody = { ...sessionDataWithFlags };
        delete expectedBody.autoRetryEnabled;
        delete expectedBody.autoContinueEnabled;

        expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
            'https://jules.googleapis.com/v1alpha/sessions',
            expect.objectContaining({
                body: JSON.stringify(expectedBody),
            })
        );
    });

    it('should not include autoRetryEnabled or autoContinueEnabled if they are false', async () => {
        const sessionDataWithoutFlags = { ...sessionData, autoRetryEnabled: false, autoContinueEnabled: false };
        const mockSession = { id: 'new-session', ...sessionDataWithoutFlags };
        (fetchClient.fetchWithRetry as vi.Mock).mockResolvedValue({
            ok: true,
            json: async () => mockSession,
        });

        await createSession(sessionDataWithoutFlags);
        const expectedBody = { ...sessionData };

        expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
            'https://jules.googleapis.com/v1alpha/sessions',
            expect.objectContaining({
                body: JSON.stringify(expectedBody),
            })
        );
    });
  });
});
