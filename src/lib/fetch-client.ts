
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface FetchOptions extends RequestInit {
  retries?: number;
  backoff?: number;
  requestId?: string;
}

type QueueItem = {
  fn: (signal: AbortSignal) => Promise<Response>;
  resolve: (value: Response | PromiseLike<Response>) => void;
  reject: (reason?: any) => void;
  controller?: AbortController; // Controlled by the queue for cancellation by ID
  externalSignal?: AbortSignal | null; // Passed from caller
  requestId?: string;
};

class RequestQueue {
  private queue: QueueItem[] = [];
  private activeCount = 0;
  private readonly maxConcurrent = 5; // Global concurrency limit
  private activeRequests: Map<string, QueueItem> = new Map(); // Map requestId to QueueItem (both queued and active)
  private lastRequestTime = 0;
  private minInterval = 200; // Minimum interval between requests in ms
  private backoffUntil = 0; // Timestamp until which backoff is active

  reportRateLimit(retryAfter: number = 0) {
    const now = Date.now();
    // Default backoff of 5 seconds if retryAfter not provided, or respect retryAfter
    const delay = retryAfter > 0 ? retryAfter : 5000;
    this.backoffUntil = now + delay;
    console.warn(`Rate limit reported. Backing off until ${new Date(this.backoffUntil).toISOString()}`);
  }

  enqueue(fn: (signal: AbortSignal) => Promise<Response>, options: { signal?: AbortSignal | null, requestId?: string }): Promise<Response> {
    return new Promise((resolve, reject) => {
      const controller = options.requestId ? new AbortController() : undefined;

      const item: QueueItem = {
        fn,
        resolve,
        reject,
        externalSignal: options.signal,
        requestId: options.requestId,
        controller
      };

      // Handle external signal (if passed directly)
      if (options.signal?.aborted) {
        return reject(new DOMException('Aborted', 'AbortError'));
      }
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
           this.removeItem(item);
           reject(new DOMException('Aborted', 'AbortError'));
        });
      }

      // Register requestId
      if (options.requestId) {
        // If there is already an active request with this ID, overwrite it?
        // Let's just track the latest one.
        this.activeRequests.set(options.requestId, item);
      }

      this.queue.push(item);
      this.processQueue();
    });
  }

  cancelRequest(requestId: string) {
    const item = this.activeRequests.get(requestId);
    if (item) {
      // If it has a controller, abort it.
      if (item.controller) {
        item.controller.abort();
      }

      // If it's in the queue, remove it.
      const index = this.queue.indexOf(item);
      if (index > -1) {
        this.queue.splice(index, 1);
        item.reject(new DOMException('Aborted', 'AbortError'));
      }

      this.activeRequests.delete(requestId);
    }
  }

  private removeItem(item: QueueItem) {
     const index = this.queue.indexOf(item);
     if (index > -1) {
       this.queue.splice(index, 1);
     }
     if (item.requestId) {
       this.activeRequests.delete(item.requestId);
     }
  }

  private async processQueue() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const now = Date.now();

    // Check backoff
    if (now < this.backoffUntil) {
      const waitTime = this.backoffUntil - now;
      setTimeout(() => this.processQueue(), waitTime);
      return;
    }

    // Rate Limiting: Check time since last request
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      setTimeout(() => this.processQueue(), waitTime);
      return;
    }

    // Update last request time immediately to prevent other concurrent processQueue calls from proceeding
    this.lastRequestTime = Date.now();

    // LIFO: Process the last item added
    const item = this.queue.pop();
    if (!item) {
        // Should not happen as we check length above, but race conditions possible?
        // Actually, since this is JS single-threaded event loop, it shouldn't be null if length > 0.
        // But if setTimeout was involved, maybe queue changed?
        // If queue is empty, we just return.
        return;
    }

    // Determine effective signal
    let effectiveSignal: AbortSignal;

    if (item.controller) {
        // If item has a controller, use it. But we should also respect externalSignal.
        // If externalSignal aborts, we should abort the controller?
        // Or create a combined signal?
        // For simplicity, if we have an internal controller, we use it.
        // If external signal fires, we remove item via event listener above.
        // But if item is already executing?
        // We should ideally abort the internal controller if external signal fires.

        if (item.externalSignal) {
             if (item.externalSignal.aborted) {
                 item.controller.abort();
             } else {
                 item.externalSignal.addEventListener('abort', () => item.controller?.abort());
             }
        }
        effectiveSignal = item.controller.signal;
    } else if (item.externalSignal) {
        effectiveSignal = item.externalSignal;
    } else {
        // Create a dummy controller if no signal provided, so we always pass a signal
        const ac = new AbortController();
        effectiveSignal = ac.signal;
        item.controller = ac; // store it just in case
    }

    // Check if aborted just before execution
    if (effectiveSignal.aborted) {
      item.reject(new DOMException('Aborted', 'AbortError'));
      if (item.requestId) this.activeRequests.delete(item.requestId);
      this.processQueue();
      return;
    }

    this.activeCount++;

    try {
      const response = await item.fn(effectiveSignal);
      item.resolve(response);
    } catch (error) {
      item.reject(error);
    } finally {
      this.activeCount--;
      if (item.requestId) {
        this.activeRequests.delete(item.requestId);
      }
      this.processQueue();
    }
  }
}

// Singleton instance
const globalQueue = new RequestQueue();

export function resetQueue() {
  // @ts-ignore - Accessing private members for testing
  globalQueue.queue = [];
  // @ts-ignore
  globalQueue.activeCount = 0;
  // @ts-ignore
  globalQueue.activeRequests.clear();
  // @ts-ignore
  globalQueue.lastRequestTime = 0;
  // @ts-ignore
  globalQueue.backoffUntil = 0;
}

export function cancelRequest(requestId: string) {
  globalQueue.cancelRequest(requestId);
}

export async function fetchWithRetry(
  url: string | URL,
  options: FetchOptions = {}
): Promise<Response> {
  const { retries = 3, backoff = 1000, signal, requestId, ...fetchOptions } = options;

  return globalQueue.enqueue(async (effectiveSignal) => {
      let attempt = 0;
      while (attempt < retries) {
        try {
          // Pass the effective signal (queue controller) to fetch
          const response = await fetch(url, { ...fetchOptions, signal: effectiveSignal });

          if (response.status === 429) {
            // Report rate limit to global queue to trigger backoff for other requests
            // Parse retry-after header if available (seconds)
            const retryAfterHeader = response.headers.get('Retry-After');
            let retryAfterMs = 0;
            if (retryAfterHeader) {
                const retryAfterSec = parseInt(retryAfterHeader, 10);
                if (!isNaN(retryAfterSec)) {
                    retryAfterMs = retryAfterSec * 1000;
                }
            }
            globalQueue.reportRateLimit(retryAfterMs);
          }

          if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
            attempt++;
            if (attempt < retries) {
              const sleepTime = backoff * Math.pow(2, attempt - 1);
              console.warn(`Request failed (${response.status}). Retrying in ${Math.round(sleepTime)}ms... (Attempt ${attempt}/${retries})`);

              if (effectiveSignal.aborted) throw new DOMException('Aborted', 'AbortError');
              await sleep(sleepTime);
              if (effectiveSignal.aborted) throw new DOMException('Aborted', 'AbortError');

              continue;
            }
          }
          return response;
        } catch (error: any) {
          if (error.name === 'AbortError') throw error;

          attempt++;
          if (attempt < retries) {
            const sleepTime = backoff * Math.pow(2, attempt - 1);
            console.warn(`Fetch error: ${error}. Retrying in ${Math.round(sleepTime)}ms... (Attempt ${attempt}/${retries})`);

            if (effectiveSignal.aborted) throw new DOMException('Aborted', 'AbortError');
            await sleep(sleepTime);
            if (effectiveSignal.aborted) throw new DOMException('Aborted', 'AbortError');

            continue;
          }
          throw error;
        }
      }
      throw new Error("Failed to fetch after multiple retries");
  }, { signal, requestId });
}
