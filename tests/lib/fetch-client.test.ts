
import { fetchWithRetry, cancelRequest, resetQueue } from '@/lib/fetch-client';
import { vi } from 'vitest';

// Helper to create a mock response
const mockResponse = (status: number, headers: Record<string, string> = {}, body: string = '') => {
  return new Response(body, { status, headers });
};

describe('fetchWithRetry', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetQueue();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

  it('should succeed on the first attempt', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse(200));
    await fetchWithRetry('http://test.com');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('should retry on 5xx errors and eventually succeed', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockResponse(500))
      .mockResolvedValueOnce(mockResponse(502))
      .mockResolvedValueOnce(mockResponse(200));

    const promise = fetchWithRetry('http://test.com', { retries: 4 });
    await vi.runAllTimersAsync();
    await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('should retry on 429 errors and eventually succeed', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockResponse(429, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(mockResponse(200));

    const promise = fetchWithRetry('http://test.com');
    await vi.runAllTimersAsync();
    await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should fail after all retries', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse(500));
    const promise = fetchWithRetry('http://test.com', { retries: 3 });
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow('Failed to fetch after multiple retries');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('should handle network errors and retry', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockResponse(200));

    const promise = fetchWithRetry('http://test.com');
    await vi.runAllTimersAsync();
    await promise;

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

    it('should support cancellation via requestId', async () => {
        const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return mockResponse(200);
        });

        const promise = fetchWithRetry('http://test.com', { requestId: 'test-cancel' });
        cancelRequest('test-cancel');

    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow('This operation was aborted');
    });

  it('should log an error with request details on failure', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() => {
        return Promise.reject(new Error('Test error'));
    });

    const promise = fetchWithRetry('http://test.com', { body: 'test body' });
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow('Test error');

    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Fetch error: Error: Test error. Request details: URL: http://test.com, Body: "test body"'));
  });
});
