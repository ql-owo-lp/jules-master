
import { db } from "@/lib/db";
import { cronJobs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { CronJob } from "@/lib/types";

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
    await db.update(cronJobs).set({ ...data }).where(eq(cronJobs.id, id));
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
