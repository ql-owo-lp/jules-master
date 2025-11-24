
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as sessionActions from '@/app/sessions/actions';
import * as fetchClient from '@/lib/fetch-client';

vi.mock('@/lib/fetch-client', () => ({
  fetchWithRetry: vi.fn(),
  cancelRequest: vi.fn(),
}));

describe('Session Actions', () => {
    beforeEach(() => {
        process.env.JULES_API_KEY = 'test-api-key';
    });

    afterEach(() => {
        vi.clearAllMocks();
        delete process.env.JULES_API_KEY;
    });

    it('listSessions should call fetchWithRetry with the correct URL', async () => {
        const mockResponse = { ok: true, json: () => Promise.resolve({ sessions: [] }) };
        vi.mocked(fetchClient.fetchWithRetry).mockResolvedValue(mockResponse as any);
        await sessionActions.listSessions();
        expect(fetchClient.fetchWithRetry).toHaveBeenCalledWith(
            'https://jules.googleapis.com/v1alpha/sessions?pageSize=50',
            expect.any(Object)
        );
    });

    it('listSessions should return mock data when MOCK_API is true', async () => {
        process.env.MOCK_API = 'true';
        const sessions = await sessionActions.listSessions();
        expect(sessions).toHaveLength(2);
        delete process.env.MOCK_API;
    });

    it('listSources should call fetchWithRetry and handle pagination', async () => {
        const mockResponse1 = { ok: true, json: () => Promise.resolve({ sources: [], nextPageToken: 'token' }) };
        const mockResponse2 = { ok: true, json: () => Promise.resolve({ sources: [] }) };
        vi.mocked(fetchClient.fetchWithRetry).mockResolvedValueOnce(mockResponse1 as any).mockResolvedValueOnce(mockResponse2 as any);
        await sessionActions.listSources();
        expect(fetchClient.fetchWithRetry).toHaveBeenCalledTimes(2);
    });

    it('cancelSessionRequest should call cancelRequest', () => {
        sessionActions.cancelSessionRequest('test-id');
        expect(fetchClient.cancelRequest).toHaveBeenCalledWith('test-id');
    });
});
