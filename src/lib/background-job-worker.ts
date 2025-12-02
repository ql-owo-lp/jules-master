
import { BackgroundJob } from "./queue-types";
import { createSession } from "@/app/sessions/new/actions";
import { addJob } from "@/app/config/actions";
import { revalidateSessions } from "@/app/sessions/actions";

// In-memory queue (in a real app, use Redis/DB)
// Since this is Next.js, this variable will be reset on server restart,
// but it should persist during runtime.
// For "even after user closes the page/browser", we need this to run outside the request context.
// Next.js server actions run in the server process. If we background the task, it should continue.
// However, Vercel/Serverless functions might kill the process.
// Assuming a long-running server (e.g. `npm start`), this in-memory queue works.
// If using serverless, we'd need an external queue (Redis/SQS).
// Given the environment seems to be a single container/process based on `start.js` and `Dockerfile`,
// we can use a global variable.

// We need to ensure this is a singleton.
// In Next.js dev mode, this might get re-initialized on HMR, but for production it should be stable?
// Actually, `globalThis` is better for dev mode persistence.

const GLOBAL_QUEUE_KEY = Symbol.for("jules.backgroundQueue");
const GLOBAL_PROCESSOR_KEY = Symbol.for("jules.backgroundProcessor");

type QueueState = {
  jobs: BackgroundJob[];
  isProcessing: boolean;
};

if (!(globalThis as any)[GLOBAL_QUEUE_KEY]) {
  (globalThis as any)[GLOBAL_QUEUE_KEY] = {
    jobs: [],
    isProcessing: false,
  };
}

const queueState = (globalThis as any)[GLOBAL_QUEUE_KEY] as QueueState;

export async function enqueueJob(jobData: Omit<BackgroundJob, 'id' | 'status' | 'retries' | 'createdAt' | 'updatedAt'>) {
  const job: BackgroundJob = {
    ...jobData,
    id: crypto.randomUUID(),
    status: 'PENDING',
    retries: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  queueState.jobs.push(job);

  // Cleanup old jobs to prevent memory leaks
  // Keep only last 1000 completed/failed jobs
  const completedJobs = queueState.jobs.filter(j => ['COMPLETED', 'FAILED'].includes(j.status));
  if (completedJobs.length > 1000) {
     const jobsToRemove = completedJobs.sort((a, b) => a.updatedAt - b.updatedAt).slice(0, completedJobs.length - 1000);
     const idsToRemove = new Set(jobsToRemove.map(j => j.id));
     queueState.jobs = queueState.jobs.filter(j => !idsToRemove.has(j.id));
  }

  console.log(`[Queue] Job ${job.id} enqueued. Total jobs: ${queueState.jobs.length}`);

  // Trigger processing asynchronously
  processQueue();

  return job.id;
}

export function startBackgroundJobWorker() {
    console.log("BackgroundJobWorker: Starting...");
    // Just trigger processing in case there are pending jobs from restart (if we had persistence)
    // Since it's in-memory, queue is empty on start, but good practice.
    processQueue();
}

export function getQueueStatus() {
  const pending = queueState.jobs.filter(j => ['PENDING', 'RETRYING', 'PROCESSING'].includes(j.status)).length;
  return {
    pendingCount: pending,
    totalCount: queueState.jobs.length,
    isProcessing: queueState.isProcessing
  };
}

async function processQueue() {
  if (queueState.isProcessing) return;

  queueState.isProcessing = true;
  console.log("[Queue] Starting queue processing...");

  try {
    while (true) {
      // Find next job to process
      const now = Date.now();
      const jobIndex = queueState.jobs.findIndex(j =>
        (j.status === 'PENDING' || j.status === 'RETRYING') &&
        (!j.nextRetryAt || j.nextRetryAt <= now)
      );

      if (jobIndex === -1) {
        // Check if there are any jobs waiting for retry in the future
        const pendingRetry = queueState.jobs.some(j => j.status === 'RETRYING');
        if (pendingRetry) {
             // Wait a bit and check again?
             // Or just exit and let the next enqueue trigger?
             // Ideally we should use a timeout, but for simplicity in this loop:
             // We can use a short sleep if we expect retries soon.
             // But to avoid blocking the thread too much, we exit and rely on
             // a polling mechanism or re-trigger.
             // Let's implement a simple poller that calls processQueue periodically if we have pending items?
             // For now, let's just exit. The next enqueue will trigger it.
             // BUT, if we are waiting for a retry, nothing might enqueue.
             // So we should probably loop with sleep or set a timeout.

             // Let's set a timeout to check again in 1 second.
             setTimeout(processQueue, 1000);
             break;
        }
        break; // No jobs to process
      }

      const job = queueState.jobs[jobIndex];
      job.status = 'PROCESSING';
      job.updatedAt = Date.now();

      console.log(`[Queue] Processing job ${job.id} (${job.retries} retries so far)`);

      try {
        const { title, prompt, source, branch, requirePlanApproval, automationMode, apiKey, jobId } = job.data;

        // Call the actual session creation
        // Note: createSession is a server action, but we can call it here.
        // It returns Promise<Session | null>.

        const newSession = await createSession({
            title,
            prompt,
            sourceContext: {
                source: source.name,
                githubRepoContext: {
                    startingBranch: branch,
                }
            },
            requirePlanApproval,
            automationMode
        }, apiKey, true); // throwOnError = true

        if (newSession) {
            job.status = 'COMPLETED';
            console.log(`[Queue] Job ${job.id} completed successfully. Session ID: ${newSession.id}`);

            // Associate session with Job
            // We need to update the job with the new session ID.
            // We can't update using `addJob` directly as it's for creating.
            // But `appDatabase.jobs.update` works if we expose it or use `addJob` if it does upsert (it doesn't seems so).
            // Actually, `appDatabase.jobs` is available in `src/app/config/actions.ts` but it's not exported.
            // Wait, `addJob` calls `appDatabase.jobs.create`.
            // We should add a new action `addSessionToJob`.

            // For now, I'll define a helper to update the job.
            try {
                // Dynamic import to avoid circular dependencies if any
                const { appDatabase } = await import('@/lib/db');
                const existingJob = await appDatabase.jobs.getById(jobId);
                if (existingJob) {
                    const updatedSessionIds = [...existingJob.sessionIds, newSession.id];
                    await appDatabase.jobs.update(jobId, { sessionIds: updatedSessionIds });
                    // Revalidate
                    const { revalidatePath } = await import('next/cache');
                    revalidatePath('/');
                }
            } catch (e) {
                console.error(`[Queue] Failed to update job ${jobId} with new session`, e);
            }

        } else {
            throw new Error("createSession returned null");
        }

      } catch (error: any) {
        console.error(`[Queue] Job ${job.id} failed:`, error);

        let isRateLimit = false;

        if (error.status === 429 || error.message.includes("429") || error.message.toLowerCase().includes("too many requests")) {
            isRateLimit = true;
        }

        job.lastError = error.message || "Unknown error";

        const maxRetries = isRateLimit ? 50 : 3;

        if (job.retries < maxRetries) {
            job.retries++;
            job.status = 'RETRYING';
            // Exponential backoff
            const backoff = 1000 * Math.pow(2, job.retries); // 2s, 4s, 8s...
            // Cap backoff at 1 minute
            const cappedBackoff = Math.min(backoff, 60000);

            job.nextRetryAt = Date.now() + cappedBackoff;
            console.log(`[Queue] Job ${job.id} scheduled for retry ${job.retries}/${maxRetries} in ${cappedBackoff}ms. RateLimit: ${isRateLimit}`);
        } else {
            job.status = 'FAILED';
            console.log(`[Queue] Job ${job.id} failed permanently after ${job.retries} retries.`);
        }
      }

      // Update the queue state? It's in-memory so it's already updated.
    }
  } finally {
    queueState.isProcessing = false;
    // Force revalidate to update UI counts
    // revalidateSessions(); // This might not be enough to update the "jobs pending" count if it's not in DB
  }
}

// We need a way to expose the queue status to the client.
// We can add a server action for this.
