
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry, cancelRequest } from '../../src/lib/fetch-client';

describe('fetchWithRetry', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
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

        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(100);

        const result = await p;
        expect(result).toBeInstanceOf(Response);
        expect(result.status).toBe(429);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Throttling (Concurrency & FIFO)', () => {
    it('should limit concurrency to 5', async () => {
        let activeCount = 0;
        let maxActive = 0;

        const delayedFetch = async () => {
            activeCount++;
            maxActive = Math.max(maxActive, activeCount);
            // Simulate delay
            await new Promise(resolve => setTimeout(resolve, 50));
            activeCount--;
            return new Response('OK');
        };

        global.fetch = vi.fn().mockImplementation(delayedFetch);

        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(fetchWithRetry(`https://api.example.com/${i}`));
        }

        // Run timers to process the queue
        await vi.advanceTimersByTimeAsync(60); // First batch finishes
        await vi.advanceTimersByTimeAsync(60); // Second batch finishes

        await Promise.all(promises);

        expect(maxActive).toBe(5);
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
         for (let i = 0; i < 10; i++) {
             promises.push(fetchWithRetry(`https://api.example.com/${i}`));
         }

         await vi.runAllTimersAsync();
         await Promise.all(promises);

         const firstBatch = startOrder.slice(0, 5).sort((a,b) => a-b);
         const secondBatch = startOrder.slice(5, 10).sort((a,b) => a-b);

         expect(firstBatch).toEqual([0, 1, 2, 3, 4]);
         expect(secondBatch).toEqual([5, 6, 7, 8, 9]);
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
          expect(abortSignal?.aborted).toBe(true);
      });

      it('should cancel a queued request', async () => {
           // Mock fetch that hangs to fill queue
           global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));

           // Fill the queue
           for (let i = 0; i < 5; i++) {
               fetchWithRetry(`https://api.example.com/fill/${i}`).catch(() => {});
           }

           const requestId = 'req-cancel-queue';
           const promise = fetchWithRetry('https://api.example.com/queued', { requestId });

           // It should be in queue now (active count = 5)

           cancelRequest(requestId);

           await expect(promise).rejects.toThrow('Aborted');
      });
  });
});

describe('fetchWithRetry', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
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
        for (let i = 0; i < 5; i++) {
            fetchWithRetry(`https://api.example.com/fill/${i}`).catch(() => {});
        }
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
