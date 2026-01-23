
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
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
      (fetchClient.fetchWithRetry as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      });

      const session = await createSession(sessionData);
      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions',
        expect.objectContaining({
          method: 'POST',
        })
      );

      const calls = (fetchClient.fetchWithRetry as Mock).mock.calls;
      const body = JSON.parse(calls[0][1].body);
      expect(body).toEqual(sessionData);
      expect(session).toEqual(mockSession);
    });

    it('should not include requirePlanApproval if it is false', async () => {
      const sessionDataWithoutApproval = { ...sessionData, requirePlanApproval: false };
      const mockSession = { id: 'new-session', ...sessionDataWithoutApproval };
      (fetchClient.fetchWithRetry as Mock).mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      });

      await createSession(sessionDataWithoutApproval);
      const expectedBody = { ...sessionDataWithoutApproval };
      delete (expectedBody as any).requirePlanApproval;

      expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
        'https://jules.googleapis.com/v1alpha/sessions',
        expect.objectContaining({
            method: 'POST',
        })
      );
      const calls = (fetchClient.fetchWithRetry as Mock).mock.calls;
      const body = JSON.parse(calls[0][1].body);
      expect(body).toEqual(expectedBody);
    });

    it('should return null if API key is missing', async () => {
      process.env.JULES_API_KEY = '';
      const session = await createSession(sessionData);
      expect(session).toBeNull();
    });

    it('should return null on API error', async () => {
      (fetchClient.fetchWithRetry as Mock).mockResolvedValue({
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
        (fetchClient.fetchWithRetry as Mock).mockResolvedValue({
            ok: true,
            json: async () => mockSession,
        });

        await createSession(sessionDataWithFlags);
        const expectedBody = { ...sessionDataWithFlags };
        delete (expectedBody as any).autoRetryEnabled;
        delete (expectedBody as any).autoContinueEnabled;

        expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
            'https://jules.googleapis.com/v1alpha/sessions',
            expect.objectContaining({
                method: 'POST',
            })
        );
        const calls = (fetchClient.fetchWithRetry as Mock).mock.calls;
        const body = JSON.parse(calls[0][1].body);
        expect(body).toEqual(expectedBody);
    });

    it('should not include autoRetryEnabled or autoContinueEnabled if they are false', async () => {
        const sessionDataWithoutFlags = { ...sessionData, autoRetryEnabled: false, autoContinueEnabled: false };
        const mockSession = { id: 'new-session', ...sessionDataWithoutFlags };
        (fetchClient.fetchWithRetry as Mock).mockResolvedValue({
            ok: true,
            json: async () => mockSession,
        });

        await createSession(sessionDataWithoutFlags);
        const expectedBody = { ...sessionData };

        expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
            'https://jules.googleapis.com/v1alpha/sessions',
            expect.objectContaining({
                method: 'POST',
            })
        );
        const calls = (fetchClient.fetchWithRetry as Mock).mock.calls;
        const body = JSON.parse(calls[0][1].body);
        expect(body).toEqual(expectedBody);
    });
  });
});
