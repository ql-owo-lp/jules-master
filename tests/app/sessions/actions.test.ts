
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listSessions, fetchSessionsPage, listSources, revalidateSessions, refreshSources, cancelSessionRequest } from '@/app/sessions/actions';
import * as fetchClient from '@/lib/fetch-client';
import { revalidateTag } from 'next/cache';

vi.mock('next/cache');

describe('Session Actions', () => {
    const mockFetchWithRetry = vi.spyOn(fetchClient, 'fetchWithRetry');

    beforeEach(() => {
        vi.resetAllMocks();
        process.env.JULES_API_KEY = 'test-api-key';
    });

    describe('listSessions', () => {
        it('should return mock sessions when MOCK_API is true', async () => {
            process.env.MOCK_API = 'true';
            const sessions = await listSessions();
            expect(sessions).toHaveLength(2);
            expect(sessions[0].id).toBe('session-1');
        });

        it('should call fetchWithRetry with the correct parameters', async () => {
            process.env.MOCK_API = 'false';
            mockFetchWithRetry.mockResolvedValueOnce(new Response(JSON.stringify({ sessions: [] })));
            await listSessions('test-key', 50, 'req-1');
            expect(mockFetchWithRetry).toHaveBeenCalledWith(
                'https://jules.googleapis.com/v1alpha/sessions?pageSize=50',
                {
                    headers: { 'X-Goog-Api-Key': 'test-key' },
                    next: { revalidate: 0, tags: ['sessions'] },
                    requestId: 'req-1'
                }
            );
        });
    });

    describe('fetchSessionsPage', () => {
        it('should return mock sessions when MOCK_API is true', async () => {
            process.env.MOCK_API = 'true';
            const { sessions } = await fetchSessionsPage();
            expect(sessions).toHaveLength(2);
            expect(sessions[0].id).toBe('session-1');
        });

        it('should call fetchWithRetry with pageToken', async () => {
            process.env.MOCK_API = 'false';
            mockFetchWithRetry.mockResolvedValueOnce(new Response(JSON.stringify({ sessions: [] })));
            await fetchSessionsPage('test-key', 'page-token', 50);
            expect(mockFetchWithRetry).toHaveBeenCalledWith(
                'https://jules.googleapis.com/v1alpha/sessions?pageSize=50&pageToken=page-token',
                {
                    headers: { 'X-Goog-Api-Key': 'test-key' },
                    next: { revalidate: 0, tags: ['sessions'] }
                }
            );
        });
    });

    describe('listSources', () => {
        it('should return mock sources when MOCK_API is true', async () => {
            process.env.MOCK_API = 'true';
            const sources = await listSources();
            expect(sources).toHaveLength(1);
            expect(sources[0].id).toBe('source-1');
        });

        it('should paginate through all sources', async () => {
            process.env.MOCK_API = 'false';
            mockFetchWithRetry.mockResolvedValueOnce(new Response(JSON.stringify({ sources: [{ id: 's1' }], nextPageToken: 'next' })));
            mockFetchWithRetry.mockResolvedValueOnce(new Response(JSON.stringify({ sources: [{ id: 's2' }] })));
            const sources = await listSources('test-key');
            expect(sources).toHaveLength(2);
            expect(sources[0].id).toBe('s1');
            expect(sources[1].id).toBe('s2');
        });
    });

    describe('revalidation', () => {
        it('should call revalidateTag for sessions', async () => {
            await revalidateSessions();
            expect(revalidateTag).toHaveBeenCalledWith('sessions');
        });

        it('should call revalidateTag for sources', async () => {
            await refreshSources();
            expect(revalidateTag).toHaveBeenCalledWith('sources');
        });
    });

    describe('cancellation', () => {
        it('should call cancelRequest', () => {
            const mockCancel = vi.spyOn(fetchClient, 'cancelRequest');
            cancelSessionRequest('req-123');
            expect(mockCancel).toHaveBeenCalledWith('req-123');
        });
    });
});
