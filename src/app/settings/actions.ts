
import { db } from "@/lib/db";
import { cronJobs, profiles } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { CronJob, Profile } from "@/lib/types";

export async function getProfiles(): Promise<Profile[]> {
  try {
    const allProfiles = await db.select().from(profiles).all();
    if (allProfiles.length === 0) {
      const newProfile: Profile = {
        id: crypto.randomUUID(),
        name: "default",
        isActive: true,
      };
      await db.insert(profiles).values(newProfile);
      return [newProfile];
    }
    return allProfiles;
  } catch (error) {
    console.error("Failed to fetch profiles:", error);
    throw error;
  }
}

export async function createProfile(data: Omit<Profile, "id" | "isActive">) {
  try {
    const newProfile = {
      ...data,
      id: crypto.randomUUID(),
      isActive: false,
    };
    await db.insert(profiles).values(newProfile);
    return newProfile;
  } catch (error) {
    console.error("Failed to create profile:", error);
    throw error;
  }
}

export async function updateProfile(id: string, data: Partial<Profile>) {
  try {
    await db.update(profiles).set(data).where(eq(profiles.id, id));
  } catch (error) {
    console.error("Failed to update profile:", error);
    throw error;
  }
}

export async function deleteProfile(id: string) {
  try {
    await db.delete(profiles).where(eq(profiles.id, id));
  } catch (error) {
    console.error("Failed to delete profile:", error);
    throw error;
  }
}

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
