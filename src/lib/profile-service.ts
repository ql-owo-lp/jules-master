
import { db } from '@/lib/db';
import { profiles, jobs, cronJobs, sessions, predefinedPrompts, historyPrompts, quickReplies, repoPrompts, globalPrompt, settings } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export type Profile = {
    id: string;
    name: string;
    githubToken: string | null;
    julesApiKey: string | null;
    isActive: boolean;
    createdAt: string;
}

export async function getActiveProfile() {
    const profile = await db.select().from(profiles).where(eq(profiles.isActive, true)).get();
    return profile;
}

export async function getAllProfiles() {
    return await db.select().from(profiles);
}

export async function createProfile(name: string, isDefault = false) {
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    if (isDefault) {
        // If creating a default (active) profile, deactivate others first
        await db.update(profiles).set({ isActive: false }).where(eq(profiles.isActive, true));
    }

    await db.insert(profiles).values({
        id,
        name,
        isActive: isDefault,
        createdAt,
    });
    return { id, name, isActive: isDefault, createdAt };
}

export async function assignOrphanedDataToProfile(profileId: string) {
    // Updates all rows where profileId is NULL to the given profileId
    await db.update(jobs).set({ profileId }).where(isNull(jobs.profileId));
    await db.update(cronJobs).set({ profileId }).where(isNull(cronJobs.profileId));
    await db.update(sessions).set({ profileId }).where(isNull(sessions.profileId));
    await db.update(predefinedPrompts).set({ profileId }).where(isNull(predefinedPrompts.profileId));
    await db.update(historyPrompts).set({ profileId }).where(isNull(historyPrompts.profileId));
    await db.update(quickReplies).set({ profileId }).where(isNull(quickReplies.profileId));
    await db.update(repoPrompts).set({ profileId }).where(isNull(repoPrompts.profileId));
    await db.update(globalPrompt).set({ profileId }).where(isNull(globalPrompt.profileId));
    await db.update(settings).set({ profileId }).where(isNull(settings.profileId));
}

export async function ensureDefaultProfile() {
    const existing = await db.select().from(profiles).limit(1);
    if (existing.length === 0) {
        const defaultProfile = await createProfile('Default', true);
        // Backfill existing data
        await assignOrphanedDataToProfile(defaultProfile.id);
    }
}

export async function getOrInitActiveProfileId(): Promise<string> {
    const profile = await getActiveProfile();
    if (profile) return profile.id;
    await ensureDefaultProfile();
    const newProfile = await getActiveProfile();
    if (!newProfile) throw new Error("Failed to initialize active profile");
    return newProfile.id;
}


export async function setActiveProfile(id: string) {
    await db.transaction(async (tx) => {
        await tx.update(profiles).set({ isActive: false }).where(eq(profiles.isActive, true));
        await tx.update(profiles).set({ isActive: true }).where(eq(profiles.id, id));
    });
}

export async function updateProfile(id: string, data: Partial<Omit<Profile, 'id' | 'createdAt'>>) {
    await db.update(profiles).set(data).where(eq(profiles.id, id));
}

export async function deleteProfile(id: string) {
    const profile = await db.select().from(profiles).where(eq(profiles.id, id)).get();
    if (profile?.isActive) {
        throw new Error("Cannot delete the active profile.");
    }
    // Check if it's the last profile
    const allProfiles = await db.select().from(profiles);
    if (allProfiles.length <= 1) {
        throw new Error("Cannot delete the last profile.");
    }

    await db.delete(profiles).where(eq(profiles.id, id));
}
