
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface FetchOptions extends RequestInit {
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

    const item = this.queue.shift();
    if (!item) return;

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

          if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
            attempt++;
            if (attempt < retries) {
              const sleepTime = backoff * Math.pow(2, attempt - 1) * (1 + Math.random() * 0.1);
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
