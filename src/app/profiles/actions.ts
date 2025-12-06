
'use server';

import { db, getActiveProfileId } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, not } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type Profile = typeof schema.profiles.$inferSelect;

export async function getProfiles(): Promise<Profile[]> {
  return db.select().from(schema.profiles);
}

export async function createProfile(name: string): Promise<Profile> {
  const newId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // Get active profile to copy settings from, or default settings
  // Wait, requirement doesn't say copy settings, but it would be nice.
  // "User can rename existing profiles. But we must make sure at least one profile is kept and selected, and user cannot remove it."

  const newProfile = {
    id: newId,
    name,
    isActive: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.insert(schema.profiles).values(newProfile);

  // Also create default settings for this profile
  await db.insert(schema.settings).values({
    profileId: newId,
    // defaults from schema will be used
  });

  revalidatePath('/settings');
  return newProfile;
}

export async function renameProfile(id: string, name: string): Promise<void> {
  await db.update(schema.profiles).set({ name, updatedAt: new Date().toISOString() }).where(eq(schema.profiles.id, id));
  revalidatePath('/settings');
}

export async function deleteProfile(id: string): Promise<void> {
    const profiles = await db.select().from(schema.profiles);
    if (profiles.length <= 1) {
        throw new Error("Cannot delete the last profile.");
    }

    const profileToDelete = profiles.find(p => p.id === id);
    if (profileToDelete?.isActive) {
        throw new Error("Cannot delete the active profile. Please switch to another profile first.");
    }

    // Delete related data
    await db.delete(schema.jobs).where(eq(schema.jobs.profileId, id));
    await db.delete(schema.cronJobs).where(eq(schema.cronJobs.profileId, id));
    await db.delete(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, id));
    await db.delete(schema.historyPrompts).where(eq(schema.historyPrompts.profileId, id));
    await db.delete(schema.quickReplies).where(eq(schema.quickReplies.profileId, id));
    await db.delete(schema.globalPrompt).where(eq(schema.globalPrompt.profileId, id));
    await db.delete(schema.repoPrompts).where(eq(schema.repoPrompts.profileId, id));
    await db.delete(schema.settings).where(eq(schema.settings.profileId, id));
    await db.delete(schema.sessions).where(eq(schema.sessions.profileId, id));

    await db.delete(schema.profiles).where(eq(schema.profiles.id, id));
    revalidatePath('/settings');
}

export async function switchProfile(id: string): Promise<void> {
    // Transaction to ensure atomicity
    await db.transaction(async (tx) => {
        // Deactivate all
        await tx.update(schema.profiles).set({ isActive: false });
        // Activate target
        await tx.update(schema.profiles).set({ isActive: true }).where(eq(schema.profiles.id, id));
    });
    revalidatePath('/'); // Revalidate everything as profile switch changes global context
    revalidatePath('/settings');
}

export async function getActiveProfile(): Promise<Profile | undefined> {
    const id = await getActiveProfileId();
    return db.query.profiles.findFirst({
        where: eq(schema.profiles.id, id)
    });
}
