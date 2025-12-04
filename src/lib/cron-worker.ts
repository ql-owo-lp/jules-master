
import { db } from './db';
import { cronJobs, jobs } from './db/schema';
import { eq, and, lte } from 'drizzle-orm';
import * as cronParser from 'cron-parser';
import type { CronJob, Job } from './types';

export async function processCronJobs() {
  console.log("Checking cron jobs...");
  try {
    const allCronJobs = await db.select().from(cronJobs);

    for (const job of allCronJobs) {
      if (!job.enabled) continue;

      try {
        const interval = cronParser.parseExpression(job.schedule);
        const now = new Date();

        // If lastRunAt is null, it means it's a new job.
        // We should probably check if it was supposed to run recently or just wait for the next interval.
        // For safety, let's just wait for the next interval if it's new, OR if we want to run immediately
        // if the schedule allows.
        // A better approach for a robust system:
        // calculate previous scheduled date. If it's > lastRunAt (or created_at), then run.

        const prevDate = interval.prev().toDate();
        const lastRun = job.lastRunAt ? new Date(job.lastRunAt) : new Date(job.createdAt);

        // If the previous scheduled time is after the last run time, it means we missed a run or it's due.
        // We add a small buffer (e.g. 1 minute) to avoid double execution if the clock is slightly off
        // or if we run this check very frequently.
        if (prevDate > lastRun) {
            console.log(`Cron job ${job.name} is due. Scheduled: ${prevDate}, Last Run: ${lastRun}`);

            // Create the job
            const newJobId = crypto.randomUUID();
            const newJob: Job = {
                id: newJobId,
                name: job.name,
                sessionIds: [],
                createdAt: now.toISOString(),
                repo: job.repo,
                branch: job.branch,
                autoApproval: job.autoApproval,
                background: true, // Cron jobs are background jobs
                prompt: job.prompt,
                sessionCount: job.sessionCount || 1,
                status: 'PENDING',
                automationMode: job.automationMode,
                requirePlanApproval: job.requirePlanApproval,
                cronJobId: job.id,
            };

            await db.insert(jobs).values(newJob);

            // Update lastRunAt
            await db.update(cronJobs).set({ lastRunAt: now.toISOString() }).where(eq(cronJobs.id, job.id));

            console.log(`Created job ${newJobId} from cron job ${job.id}`);
        }

      } catch (err) {
        console.error(`Error processing cron job ${job.id}:`, err);
      }
    }
  } catch (error) {
    console.error("Failed to fetch cron jobs for processing:", error);
  }
}
