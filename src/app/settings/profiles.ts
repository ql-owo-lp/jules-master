
"use server";

import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Profile } from "@/lib/types";

export async function getProfiles(): Promise<Profile[]> {
  return db.select().from(profiles) as Promise<Profile[]>;
}

export async function getSelectedProfile(): Promise<Profile> {
    const selectedProfile = await db.select().from(profiles).where(eq(profiles.isSelected, true)).limit(1);
    if (selectedProfile.length > 0) {
        return selectedProfile[0] as Profile;
    }

    const firstProfile = await db.select().from(profiles).limit(1);
    if (firstProfile.length > 0) {
        await db.update(profiles).set({ isSelected: true }).where(eq(profiles.id, firstProfile[0].id));
        return firstProfile[0] as Profile;
    }

    const defaultProfile = {
        id: crypto.randomUUID(),
        name: "Default",
        createdAt: new Date().toISOString(),
        isSelected: true,
    };
    await db.insert(profiles).values(defaultProfile);
    return defaultProfile as Profile;
}

export async function createProfile(data: { name: string }): Promise<Profile> {
  const newProfile = {
    id: crypto.randomUUID(),
    name: data.name,
    createdAt: new Date().toISOString(),
    isSelected: false,
  };
  await db.insert(profiles).values(newProfile);
  return newProfile as Profile;
}

export async function updateProfile(profile: Profile): Promise<void> {
  await db.update(profiles).set({ ...profile, updatedAt: new Date().toISOString() }).where(eq(profiles.id, profile.id));
}

export async function deleteProfile(id: string): Promise<void> {
  await db.delete(profiles).where(eq(profiles.id, id));
}

export async function setSelectedProfile(id: string): Promise<void> {
  await db.update(profiles).set({ isSelected: false });
  await db.update(profiles).set({ isSelected: true }).where(eq(profiles.id, id));
}
