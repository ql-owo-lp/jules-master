
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Profile } from "@/lib/types";

export async function getProfiles(): Promise<Profile[]> {
  let allProfiles = await db.select().from(profiles).all();
  if (allProfiles.length === 0) {
    const defaultProfileId = crypto.randomUUID();
    await db.insert(profiles).values({ id: defaultProfileId, name: 'Default', isActive: true }).run();
    allProfiles = await db.select().from(profiles).all();
  }
  return allProfiles;
}

export async function getActiveProfile(): Promise<Profile | null> {
  const activeProfile = await db.query.profiles.findFirst({
    where: eq(profiles.isActive, true),
  });
  return activeProfile || null;
}

export async function createProfile(name: string): Promise<void> {
  await db.insert(profiles).values({ id: crypto.randomUUID(), name, isActive: false }).run();
  revalidatePath("/settings?tab=profiles");
}

export async function updateProfile(profile: Profile): Promise<void> {
  await db.update(profiles).set(profile).where(eq(profiles.id, profile.id)).run();
  revalidatePath("/settings?tab=profiles");
}

export async function deleteProfile(id: string): Promise<void> {
  const allProfiles = await db.select().from(profiles).all();
  if (allProfiles.length > 1) {
    await db.delete(profiles).where(eq(profiles.id, id)).run();
    revalidatePath("/settings?tab=profiles");
  }
}

export async function setActiveProfile(id: string): Promise<void> {
  db.transaction((tx) => {
    tx.update(profiles).set({ isActive: false }).run();
    tx.update(profiles).set({ isActive: true }).where(eq(profiles.id, id)).run();
  });
  revalidatePath("/settings?tab=profiles");
}
