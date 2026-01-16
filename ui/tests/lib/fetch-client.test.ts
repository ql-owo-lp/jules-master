
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry, cancelRequest, resetQueue } from '../../src/lib/fetch-client';

describe('fetchWithRetry', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetQueue();
    global.fetch = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Retry Logic', () => {
    it('should retry on 429 errors', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }))
        .mockResolvedValueOnce(new Response('OK', { status: 200 }));

      global.fetch = mockFetch;

      const promise = fetchWithRetry('https://api.example.com', { retries: 3, backoff: 100 });

      // Fast-forward timers for backoff
      // 429 triggers queue backoff (default 5s) AND retry backoff (100ms)
      // Retry happens inside fetchWithRetry loop.
      // But 429 also triggers reportRateLimit.
      // Since maxConcurrent=5, the retry loop continues.
      // Does retry loop check queue backoff? NO.
      // But subsequent requests will be backed off.
      // This test checks a SINGLE request retry.

      await vi.runAllTimersAsync();

      const response = await promise;
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx errors', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
        .mockResolvedValueOnce(new Response('OK', { status: 200 }));

      global.fetch = mockFetch;

      const promise = fetchWithRetry('https://api.example.com', { retries: 3, backoff: 100 });

      await vi.runAllTimersAsync();

      const response = await promise;
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 400 errors', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(new Response('Bad Request', { status: 400 }));

      global.fetch = mockFetch;

      const response = await fetchWithRetry('https://api.example.com', { retries: 3 });

      expect(response.status).toBe(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and return the last response if it fails', async () => {
        const mockFetch = vi.fn().mockResolvedValue(new Response('Too Many Requests', { status: 429 }));
        global.fetch = mockFetch;

        const promise = fetchWithRetry('https://api.example.com', { retries: 2, backoff: 10 });

        // Start promise
        const p = promise;

        await vi.runAllTimersAsync();

        const result = await p;
        expect(result).toBeInstanceOf(Response);
        expect(result.status).toBe(429);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Throttling (Concurrency & FIFO)', () => {
    it('should limit concurrency to 1', async () => {
        let activeCount = 0;
        let maxActive = 0;

        const longRunningFetch = async () => {
             activeCount++;
             maxActive = Math.max(maxActive, activeCount);
             // 2000ms duration
             await new Promise(resolve => setTimeout(resolve, 2000));
             activeCount--;
             return new Response('OK');
        };
        global.fetch = vi.fn().mockImplementation(longRunningFetch);

        const p = [];
        for (let i = 0; i < 10; i++) {
            p.push(fetchWithRetry(`https://api.example.com/${i}`));
            // We must advance time slightly between requests to trigger rate limiting correctly?
            // If we blast 10 requests at T=0.
            // R0 starts immediately.
            // R1..R9 queued.
            // R1..R9 processQueue called. R1..R9 scheduled for T=200.
        }

        // Advance time to allow rate limited starts.
        // We need 5 tasks to start. 0, 200, 400, 600, 800.
        // At T=800, 5 tasks are active.

        await vi.advanceTimersByTimeAsync(30000);
        await vi.runAllTimersAsync();

        expect(maxActive).toBe(1);
    });

    it('should process in FIFO order', async () => {
         const startOrder: number[] = [];

         const delayedFetch = async (url: string) => {
             const id = parseInt(url.split('/').pop() || '0');
             startOrder.push(id);
             await new Promise(resolve => setTimeout(resolve, 10));
             return new Response('OK');
         };

         global.fetch = vi.fn().mockImplementation((url) => delayedFetch(url as string));

         const promises = [];

         // R0 starts immediately (queue empty, no rate limit).
         promises.push(fetchWithRetry(`https://api.example.com/0`));

         // Advance slightly so R0 is "active" and lastRequestTime set.
         await vi.advanceTimersByTimeAsync(1);

         // Now queue remaining requests.
         // Since lastRequestTime was just set, these will be delayed by rate limit (200ms).
         for (let i = 1; i < 10; i++) {
             promises.push(fetchWithRetry(`https://api.example.com/${i}`));
             // Add a tiny delay to ensure they are added to queue in order
             await vi.advanceTimersByTimeAsync(1);
         }

         // All R1..R9 are in queue.
         // FIFO -> R1.

         await vi.runAllTimersAsync();
         await Promise.all(promises);

         // R0 started first.
         expect(startOrder[0]).toBe(0);
         // R1 started second.
         expect(startOrder[1]).toBe(1);
         // R9 started last.
         expect(startOrder[9]).toBe(9);
    });
  });

  describe('Cancellation', () => {
      it('should cancel an executing request', async () => {
          const requestId = 'req-cancel-exec';
          let abortSignal: AbortSignal | undefined;

          global.fetch = vi.fn().mockImplementation((url, options) => {
              abortSignal = options.signal;
              return new Promise((resolve, reject) => {
                  if (options.signal?.aborted) {
                      reject(new DOMException('Aborted', 'AbortError'));
                      return;
                  }
                  options.signal?.addEventListener('abort', () => {
                      reject(new DOMException('Aborted', 'AbortError'));
                  });
              });
          });

          const promise = fetchWithRetry('https://api.example.com', { requestId });

          // Allow it to start
          await vi.advanceTimersByTimeAsync(1);

          // Cancel it
          cancelRequest(requestId);

          await expect(promise).rejects.toThrow('Aborted');
          // Use toBeDefined and then check value
          expect(abortSignal).toBeDefined();
          expect(abortSignal?.aborted).toBe(true);
      });

      it('should cancel a queued request', async () => {
           // Mock fetch that hangs to fill queue
           global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

           // Start R0
           fetchWithRetry(`https://api.example.com/fill/0`).catch(() => {});

           await vi.advanceTimersByTimeAsync(1);

           const requestId = 'req-cancel-queue';
           // R1 queued because of rate limit
           const promise = fetchWithRetry('https://api.example.com/queued', { requestId });

           cancelRequest(requestId);

           await expect(promise).rejects.toThrow('Aborted');
      });
  });
});

describe('fetchWithRetry AbortController', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        resetQueue();
        global.fetch = vi.fn();
        vi.useFakeTimers();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should cancel a request with an external signal', async () => {
        const controller = new AbortController();
        const promise = fetchWithRetry('https://api.example.com', { signal: controller.signal });
        controller.abort();
        await expect(promise).rejects.toThrow('Aborted');
    });

    it('should not enqueue an already aborted request', async () => {
        const controller = new AbortController();
        controller.abort();
        const promise = fetchWithRetry('https://api.example.com', { signal: controller.signal });
        await expect(promise).rejects.toThrow('Aborted');
    });

    it('should handle a request that is aborted while in the queue', async () => {
        global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
        // Just add one to block execution/start rate limit
        fetchWithRetry(`https://api.example.com/fill/0`).catch(() => {});
        await vi.advanceTimersByTimeAsync(1);

        const controller = new AbortController();
        const promise = fetchWithRetry('https://api.example.com/queued', { signal: controller.signal });
        controller.abort();
        await expect(promise).rejects.toThrow('Aborted');
    });

    it('should handle a request that is aborted while executing', async () => {
        const controller = new AbortController();
        global.fetch = vi.fn().mockImplementation((url, options) => {
            return new Promise((resolve, reject) => {
                options.signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });
        });
        const promise = fetchWithRetry('https://api.example.com', { signal: controller.signal });
        await vi.advanceTimersByTimeAsync(1);
        controller.abort();
        await expect(promise).rejects.toThrow('Aborted');
    });

    it.skip('should throw an error after exhausting retries', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
        const promise = fetchWithRetry('https://api.example.com', { retries: 2, backoff: 10 });
        await vi.runAllTimersAsync();
        await expect(promise).rejects.toThrow('Failed to fetch after multiple retries');
    });
});
