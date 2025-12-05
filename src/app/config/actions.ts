
"use server";

import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Profile } from "@/lib/types";

export async function getProfiles(): Promise<Profile[]> {
  try {
    let allProfiles = await db.select().from(profiles);
    if (allProfiles.length === 0) {
      const defaultProfile: Profile = {
        id: crypto.randomUUID(),
        name: "Default",
        isActive: true,
        settings: {
          julesApiKey: "",
          githubToken: "",
          idlePollInterval: 120,
          activePollInterval: 30,
          titleTruncateLength: 50,
          lineClamp: 1,
          sessionItemsPerPage: 10,
          jobsPerPage: 5,
          defaultSessionCount: 10,
          prStatusPollInterval: 60,
          historyPromptsCount: 10,
          autoApprovalInterval: 60,
          autoRetryEnabled: true,
          autoRetryMessage: "You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution",
          autoContinueEnabled: true,
          autoContinueMessage: "Sounds good. Now go ahead finish the work",
          debugMode: false,
          sessionCacheInProgressInterval: 60,
          sessionCacheCompletedNoPrInterval: 1800,
          sessionCachePendingApprovalInterval: 300,
          sessionCacheMaxAgeDays: 3,
          autoDeleteStaleBranches: false,
          autoDeleteStaleBranchesAfterDays: 3,
        },
      };
      await db.insert(profiles).values(defaultProfile);
      allProfiles = [defaultProfile];
    }
    return allProfiles;
  } catch (error) {
    console.error("Failed to fetch profiles:", error);
    throw error;
  }
}

export async function getActiveProfile(): Promise<Profile | null> {
  try {
    const activeProfile = await db.select().from(profiles).where(eq(profiles.isActive, true));
    return activeProfile[0] || null;
  } catch (error) {
    console.error("Failed to fetch active profile:", error);
    throw error;
  }
}

export async function saveProfile(profile: Profile) {
  try {
    await db.insert(profiles).values(profile).onConflictDoUpdate({
      target: profiles.id,
      set: {
        name: profile.name,
        settings: profile.settings,
        isActive: profile.isActive,
      },
    });
  } catch (error) {
    console.error("Failed to save profile:", error);
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
