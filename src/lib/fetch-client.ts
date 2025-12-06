
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface FetchOptions extends RequestInit {
  retries?: number;
  backoff?: number;
  requestId?: string;
}

type QueueItem = {
  fn: (signal: AbortSignal) => Promise<Response>;
  resolve: (value: Response | PromiseLike<Response>) => void;
  reject: (reason?: unknown) => void;
  controller?: AbortController; // Controlled by the queue for cancellation by ID
  externalSignal?: AbortSignal | null; // Passed from caller
  requestId?: string;
};

// Helper to parse Retry-After header
function parseRetryAfter(header: string | null): number {
  if (!header) return 0;

  // Try parsing as seconds first (most common for rate limits)
  // Check if it looks like a number
  if (/^\d+$/.test(header)) {
      const retryAfterSec = parseInt(header, 10);
      if (!isNaN(retryAfterSec)) {
        return retryAfterSec * 1000;
      }
  }

  // Try parsing as date
  const date = Date.parse(header);
  if (!isNaN(date)) {
    const delay = date - Date.now();
    return delay > 0 ? delay : 0;
  }

  return 0;
}

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

    // Ensure we don't reduce the backoff if it's already set further in the future
    this.backoffUntil = Math.max(this.backoffUntil, now + delay);

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
        return;
    }

    // Determine effective signal
    let effectiveSignal: AbortSignal;

    if (item.controller) {
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
  // @ts-expect-error -- Resetting private members for testing
  globalQueue.queue = [];
  // @ts-expect-error -- Resetting private members for testing
  globalQueue.activeCount = 0;
  // @ts-expect-error -- Resetting private members for testing
  globalQueue.activeRequests.clear();
  // @ts-expect-error -- Resetting private members for testing
  globalQueue.lastRequestTime = 0;
  // @ts-expect-error -- Resetting private members for testing
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

  // Mock API logic
  if (process.env.MOCK_API === 'true') {
    if (url.toString().includes('sessions')) {
        await sleep(500); // Simulate network delay
        return new Response(JSON.stringify({
            id: 'mock-session-id',
            name: 'mock-session-name',
            title: 'Mock Session',
            prompt: 'Mock Prompt',
            sourceContext: { source: 'github', githubRepoContext: { startingBranch: 'main' } },
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
            state: 'COMPLETED',
            lastUpdated: Date.now()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
     if (url.toString().includes('jobs')) {
        await sleep(500);
        return new Response(JSON.stringify({
             id: 'mock-job-id',
             name: 'Mock Job',
             sessionIds: ['mock-session-id'],
             createdAt: new Date().toISOString(),
             repo: 'owner/repo',
             branch: 'main',
             status: 'COMPLETED'
        }), {
             status: 200,
             headers: { 'Content-Type': 'application/json' }
        });
     }
  }

  return globalQueue.enqueue(async (effectiveSignal) => {
      let attempt = 0;
      while (attempt < retries) {
        try {
          // Pass the effective signal (queue controller) to fetch
          const response = await fetch(url, { ...fetchOptions, signal: effectiveSignal });

          let sleepTime = 0;

          if (response.status === 429) {
            const retryAfterHeader = response.headers.get('Retry-After');
            const retryAfterMs = parseRetryAfter(retryAfterHeader);

            // Update global queue with rate limit info
            globalQueue.reportRateLimit(retryAfterMs);

            // For the current request sleep time, respect retryAfterMs
            sleepTime = retryAfterMs;
          }

          if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
            attempt++;
            if (attempt < retries) {
              // Calculate exponential backoff
              const backoffSleep = backoff * Math.pow(2, attempt - 1);

              // Use the maximum of calculated backoff and Retry-After
              sleepTime = Math.max(sleepTime, backoffSleep);

              // Cap sleep time to avoid excessive waits if needed?
              // For now, assume Retry-After is authoritative, but if it's crazy high, maybe log it.

              console.warn(`Request failed (${response.status}). Retrying in ${Math.round(sleepTime)}ms... (Attempt ${attempt}/${retries})`);

              if (effectiveSignal.aborted) throw new DOMException('Aborted', 'AbortError');
              await sleep(sleepTime);
              if (effectiveSignal.aborted) throw new DOMException('Aborted', 'AbortError');

              continue;
            }
          }
          return response;
        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'AbortError') throw error;

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
