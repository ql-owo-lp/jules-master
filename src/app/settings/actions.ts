
import { db } from "@/lib/db";
import { cronJobs, jobs } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";
import type { CronJob, State } from "@/lib/types";

export async function getCronJobs(): Promise<CronJob[]> {
  try {
    const jobs = await db.select().from(cronJobs).orderBy(desc(cronJobs.createdAt));
    return jobs as CronJob[];
  } catch (error) {
    console.error("Failed to fetch cron jobs:", error);
    return [];
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
    await db.update(cronJobs).set(data).where(eq(cronJobs.id, id));
  } catch (error) {
    console.error("Failed to update cron job:", error);
    throw error;
  }
}

export async function toggleCronJob(id: string, enabled: boolean) {
    try {
        await db.update(cronJobs).set({ enabled }).where(eq(cronJobs.id, id));
    } catch (error) {
        console.error("Failed to toggle cron job:", error);
        throw error;
    }
}

export async function getCronJobHistory(id: string, page: number, limit: number, status: string) {
    try {
        const where = [eq(jobs.cronJobId, id)];
        if (status !== 'all') {
            where.push(eq(jobs.status, status as State));
        }

        const historyJobs = await db.select().from(jobs).where(eq(jobs.cronJobId, id)).orderBy(desc(jobs.createdAt)).limit(limit).offset((page - 1) * limit);
        const total = await db.select({ count: count() }).from(jobs).where(eq(jobs.cronJobId, id));

        return {
            jobs: historyJobs,
            totalPages: Math.ceil(total[0].count / limit),
        };
    } catch (error) {
        console.error("Failed to fetch cron job history:", error);
        throw new Error("Failed to fetch cron job history");
    }
}

export async function clearCronJobHistory(id: string) {
    try {
        await db.delete(jobs).where(eq(jobs.cronJobId, id));
    } catch (error) {
        console.error("Failed to clear cron job history:", error);
        throw new Error("Failed to clear cron job history");
    }
}
