
'use server';

import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import type { Job, PredefinedPrompt, HistoryPrompt, Profile } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { eq, desc, or, and } from 'drizzle-orm';

// --- Profiles ---
export async function getProfiles(): Promise<Profile[]> {
    return appDatabase.profiles.getAll();
}

export async function getActiveProfile(): Promise<Profile> {
    return appDatabase.profiles.getActive();
}

export async function createProfile(name: string): Promise<Profile> {
    const newProfile: Profile = {
        id: crypto.randomUUID(),
        name,
        isActive: false,
        createdAt: new Date().toISOString()
    };
    await appDatabase.profiles.create(newProfile);
    revalidatePath('/settings');
    return newProfile;
}

export async function renameProfile(id: string, name: string): Promise<void> {
    await appDatabase.profiles.update(id, { name });
    revalidatePath('/settings');
}

export async function setActiveProfile(id: string): Promise<void> {
    await appDatabase.profiles.setActive(id);
    revalidatePath('/settings');
    revalidatePath('/'); // Refresh entire app as settings/jobs change
}

export async function deleteProfile(id: string): Promise<void> {
    // Check if it's the active profile or the last one?
    // Requirement: "We must make sure at least one profile is kept and selected, and user cannot remove it."
    const allProfiles = await appDatabase.profiles.getAll();
    if (allProfiles.length <= 1) {
        throw new Error("Cannot delete the last profile.");
    }
    const profile = allProfiles.find(p => p.id === id);
    if (profile?.isActive) {
         throw new Error("Cannot delete the active profile. Please switch to another profile first.");
    }

    await appDatabase.profiles.delete(id);
    revalidatePath('/settings');
}


// --- Jobs ---
export async function getJobs(): Promise<Job[]> {
    const activeProfile = await getActiveProfile();
    return appDatabase.jobs.getAll(activeProfile.id);
}

export async function addJob(job: Job): Promise<void> {
    const activeProfile = await getActiveProfile();
    job.profileId = activeProfile.id;
    await appDatabase.jobs.create(job);
    revalidatePath('/jobs');
    revalidatePath('/');
}

export async function getPendingBackgroundWorkCount(): Promise<{ pendingJobs: number, retryingSessions: number }> {
    // This seems to be global work, not necessarily scoped to profile,
    // BUT if the worker is processing jobs, it might need to know which profile context...
    // However, the worker picks up jobs from the DB.
    // The requirement says "convert the settings / jobs/ everything to be aware of user / profile".
    // If multiple users use the same backend, the background worker needs to handle all of them.
    // For the UI count (notification badge), it should probably be scoped to the current user/profile.

    const activeProfile = await getActiveProfile();

    const pendingJobs = await db.select().from(schema.jobs).where(
        and(
            eq(schema.jobs.profileId, activeProfile.id),
            or(eq(schema.jobs.status, 'PENDING'), eq(schema.jobs.status, 'PROCESSING'))
        )
    );

    const failedSessions = await db.select().from(schema.sessions).where(
        and(
             eq(schema.sessions.profileId, activeProfile.id),
             eq(schema.sessions.state, 'FAILED')
        )
    );
    let retryingSessionsCount = 0;

    for (const session of failedSessions) {
        const errorReason = session.lastError || "";
        const isRateLimit = errorReason.toLowerCase().includes("too many requests") || errorReason.includes("429");
        const maxRetries = isRateLimit ? 50 : 3;
        if ((session.retryCount || 0) < maxRetries) {
            retryingSessionsCount++;
        }
    }

    return {
        pendingJobs: pendingJobs.length,
        retryingSessions: retryingSessionsCount
    };
}

// --- Predefined Prompts ---
export async function getPredefinedPrompts(): Promise<PredefinedPrompt[]> {
    const activeProfile = await getActiveProfile();
    return appDatabase.predefinedPrompts.getAll(activeProfile.id);
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    const activeProfile = await getActiveProfile();
    // Filter to ensure we only touch this profile's prompts
    // But the API assumes we pass the full list for the current view?
    // The previous implementation was a transaction delete-all-insert-all.
    // We should only delete prompts for THIS profile.

    const promptsWithProfile = prompts.map(p => ({ ...p, profileId: activeProfile.id }));

    db.transaction((tx) => {
        tx.delete(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, activeProfile.id)).run();
        if (promptsWithProfile.length > 0) {
            tx.insert(schema.predefinedPrompts).values(promptsWithProfile).run();
        }
    });
    revalidatePath('/settings');
}

// --- History Prompts ---
export async function getHistoryPrompts(): Promise<HistoryPrompt[]> {
    const activeProfile = await getActiveProfile();
    const settings = await appDatabase.settings.get(activeProfile.id);
    const limit = settings?.historyPromptsCount ?? 10;
    return appDatabase.historyPrompts.getRecent(limit, activeProfile.id);
}

export async function saveHistoryPrompt(promptText: string): Promise<void> {
    if (!promptText.trim()) return;
    const activeProfile = await getActiveProfile();

    // Check if prompt already exists for this profile
    const existing = await db.select().from(schema.historyPrompts).where(
        and(
            eq(schema.historyPrompts.prompt, promptText),
            eq(schema.historyPrompts.profileId, activeProfile.id)
        )
    ).get();

    if (existing) {
        await appDatabase.historyPrompts.update(existing.id, { lastUsedAt: new Date().toISOString() });
    } else {
        const newHistoryPrompt: HistoryPrompt = {
            id: crypto.randomUUID(),
            prompt: promptText,
            lastUsedAt: new Date().toISOString(),
            profileId: activeProfile.id
        };
        await appDatabase.historyPrompts.create(newHistoryPrompt);
    }

    revalidatePath('/');
}

// --- Quick Replies ---
export async function getQuickReplies(): Promise<PredefinedPrompt[]> {
    const activeProfile = await getActiveProfile();
    return appDatabase.quickReplies.getAll(activeProfile.id);
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    const activeProfile = await getActiveProfile();
    const repliesWithProfile = replies.map(r => ({ ...r, profileId: activeProfile.id }));

    db.transaction((tx) => {
        tx.delete(schema.quickReplies).where(eq(schema.quickReplies.profileId, activeProfile.id)).run();
        if (repliesWithProfile.length > 0) {
            tx.insert(schema.quickReplies).values(repliesWithProfile).run();
        }
    });
    revalidatePath('/settings');
}

// --- Global Prompt ---
export async function getGlobalPrompt(): Promise<string> {
    const activeProfile = await getActiveProfile();
    const result = await appDatabase.globalPrompt.get(activeProfile.id);
    return result?.prompt ?? "";
}

export async function saveGlobalPrompt(prompt: string): Promise<void> {
    const activeProfile = await getActiveProfile();
    await appDatabase.globalPrompt.save(prompt, activeProfile.id);
    revalidatePath('/settings');
}

// --- Repo Prompt ---
export async function getRepoPrompt(repo: string): Promise<string> {
    const activeProfile = await getActiveProfile();
    const result = await appDatabase.repoPrompts.get(repo, activeProfile.id);
    return result?.prompt ?? "";
}

export async function saveRepoPrompt(repo: string, prompt: string): Promise<void> {
    const activeProfile = await getActiveProfile();
    await appDatabase.repoPrompts.save(repo, prompt, activeProfile.id);
    revalidatePath('/settings');
}

// --- Settings ---
export async function getSettings() {
    const activeProfile = await getActiveProfile();
    return appDatabase.settings.get(activeProfile.id);
}
