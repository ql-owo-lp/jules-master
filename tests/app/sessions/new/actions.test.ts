
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createSession } from '@/app/sessions/new/actions';
import * as fetchClient from '@/lib/fetch-client';
import { Session } from '@/lib/types';

vi.mock('@/lib/fetch-client', () => ({
  fetchWithRetry: vi.fn(),
}));

describe('createSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.JULES_API_KEY = 'test-api-key';
  });

  const sessionData = {
    prompt: 'Test prompt',
    sourceContext: { source: 'sources/github/test/repo' },
  };

  it('should create a session successfully', async () => {
    const mockSession: Session = {
      id: '123',
      name: 'sessions/123',
      title: 'Test Session',
      createTime: new Date().toISOString(),
      state: 'RUNNING',
      prompt: 'Test prompt',
      sourceContext: { source: 'sources/github/test/repo' },
    };
    const mockResponse = {
      ok: true,
      json: async () => mockSession,
    };
    vi.mocked(fetchClient.fetchWithRetry).mockResolvedValue(mockResponse as any);

    const result = await createSession(sessionData);

    expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
      'https://jules.googleapis.com/v1alpha/sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(sessionData),
      })
    );
    expect(result).toEqual(mockSession);
  });

  it('should return null if API key is not configured', async () => {
    delete process.env.JULES_API_KEY;
    const result = await createSession(sessionData);
    expect(result).toBeNull();
    expect(fetchClient.fetchWithRetry).not.toHaveBeenCalled();
  });

  it('should return null if the fetch request fails', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Error body',
    };
    vi.mocked(fetchClient.fetchWithRetry).mockResolvedValue(mockResponse as any);

    const result = await createSession(sessionData);
    expect(result).toBeNull();
  });

  it('should return null if fetchWithRetry throws an error', async () => {
    vi.mocked(fetchClient.fetchWithRetry).mockRejectedValue(new Error('Network Error'));
    const result = await createSession(sessionData);
    expect(result).toBeNull();
  });

  it('should not include requirePlanApproval in the body if it is false', async () => {
    const mockResponse = { ok: true, json: async () => ({}) };
    vi.mocked(fetchClient.fetchWithRetry).mockResolvedValue(mockResponse as any);

    await createSession({ ...sessionData, requirePlanApproval: false });

    expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify(sessionData),
      })
    );
  });

  it('should include requirePlanApproval in the body if it is true', async () => {
    const mockResponse = { ok: true, json: async () => ({}) };
    vi.mocked(fetchClient.fetchWithRetry).mockResolvedValue(mockResponse as any);
    const sessionDataWithApproval = { ...sessionData, requirePlanApproval: true };

    await createSession(sessionDataWithApproval);

    expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify(sessionDataWithApproval),
      })
    );
  });
});
