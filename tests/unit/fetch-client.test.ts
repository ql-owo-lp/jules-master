
import { vi } from 'vitest';
import { fetchWithRetry } from '@/lib/fetch-client';

// Mock fetch
global.fetch = vi.fn();

describe('fetch-client', () => {
  it('should retry on 5xx errors', async () => {
    // @ts-ignore
    fetch.mockResolvedValueOnce({ status: 500 });
    // @ts-ignore
    fetch.mockResolvedValueOnce({ status: 200, json: () => Promise.resolve({}) });

    await fetchWithRetry('https://example.com');

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should retry on 429 errors', async () => {
    // @ts-ignore
    fetch.mockResolvedValueOnce({ status: 429, headers: { get: () => '1' } });
    // @ts-ignore
    fetch.mockResolvedValueOnce({ status: 200, json: () => Promise.resolve({}) });

    await fetchWithRetry('https://example.com');

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should log detailed error messages', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-ignore
    fetch.mockRejectedValue(new Error('Network error'));

    try {
      await fetchWithRetry('https://example.com', { retries: 1 });
    } catch (e) {
      // do nothing
    }

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Fetch error. Retrying...',
      expect.objectContaining({
        error: 'Network error',
        url: 'https://example.com',
      })
    );

    consoleWarnSpy.mockRestore();
  });
});
