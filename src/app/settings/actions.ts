
import { db } from "@/lib/db";
import { cronJobs, jobs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { CronJob, Job } from "@/lib/types";

export async function getCronJobs(): Promise<CronJob[]> {
  try {
    const jobs = await db.select().from(cronJobs).orderBy(desc(cronJobs.createdAt));
    return jobs as CronJob[];
  } catch (error) {
    console.error("Failed to fetch cron jobs:", error);
    throw error;
  }
}

export async function createCronJob(data: Omit<CronJob, "id" | "createdAt" | "lastRunAt">) {
  try {
    const newCronJob = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      enabled: true,
    };
    await db.insert(cronJobs).values(newCronJob);
    return newCronJob;
  } catch (error) {
    console.error("Failed to create cron job:", error);
    throw error;
  }
}

export async function deleteCronJob(id: string) {
  try {
    await db.delete(cronJobs).where(eq(cronJobs.id, id));
  } catch (error) {
    console.error("Failed to delete cron job:", error);
    throw error;
  }
}

export async function updateCronJob(id: string, data: Partial<CronJob>) {
  try {
    await db.update(cronJobs).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(cronJobs.id, id));
  } catch (error) {
    console.error("Failed to update cron job:", error);
    throw error;
  }
}

export async function toggleCronJob(id: string, enabled: boolean) {
    try {
        await db.update(cronJobs).set({ enabled, updatedAt: new Date().toISOString() }).where(eq(cronJobs.id, id));
    } catch (error) {
        console.error("Failed to toggle cron job:", error);
        throw error;
    }
}

export async function triggerCronJob(id: string) {
    try {
        const result = await db.select().from(cronJobs).where(eq(cronJobs.id, id));
        if (result.length === 0) {
            throw new Error(`Cron job with id ${id} not found`);
        }
        const job = result[0];
        const now = new Date();
        const newJobId = crypto.randomUUID();
        const newJob: Job = {
            id: newJobId,
            name: job.name,
            sessionIds: [],
            createdAt: now.toISOString(),
            repo: job.repo,
            sourceName: job.sourceName,
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
        // We do NOT update lastRunAt when manually triggered

        return newJobId;
    } catch (error) {
        console.error("Failed to trigger cron job:", error);
        throw error;
    }
}
