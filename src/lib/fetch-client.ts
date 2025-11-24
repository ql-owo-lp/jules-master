
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface FetchOptions extends RequestInit {
  retries?: number;
  backoff?: number;
}

export async function fetchWithRetry(
  url: string | URL,
  options: FetchOptions = {}
): Promise<Response> {
  const { retries = 3, backoff = 1000, ...fetchOptions } = options;
  let attempt = 0;

  while (attempt < retries) {
    try {
      const response = await fetch(url, fetchOptions);

      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        attempt++;
        if (attempt < retries) {
          // Exponential backoff with jitter
          const sleepTime = backoff * Math.pow(2, attempt - 1) * (1 + Math.random() * 0.1);
          console.warn(`Request failed (${response.status}). Retrying in ${Math.round(sleepTime)}ms... (Attempt ${attempt}/${retries})`);
          await sleep(sleepTime);
          continue;
        }
      }

      return response;
    } catch (error) {
       // Only retry network errors if we haven't exhausted retries
       // For now, we are focusing on 429 as requested, but retrying network errors is also good practice.
       // However, to strictly follow "throttle... when a lot of sessions" (429), I will prioritize 429.
       // If fetch throws (network error), we might want to retry.

       attempt++;
       if (attempt < retries) {
          const sleepTime = backoff * Math.pow(2, attempt - 1);
          console.warn(`Fetch error: ${error}. Retrying in ${Math.round(sleepTime)}ms... (Attempt ${attempt}/${retries})`);
          await sleep(sleepTime);
          continue;
       }
       throw error;
    }
  }

  // Should not be reached if loop logic is correct and we return/throw inside
  throw new Error("Failed to fetch after multiple retries");
}
