
'use server';

import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import type { Job, PredefinedPrompt, HistoryPrompt } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { eq, desc, or } from 'drizzle-orm';

// --- Jobs ---
export async function getJobs(): Promise<Job[]> {
    return appDatabase.jobs.getAll();
}

export async function addJob(job: Job): Promise<void> {
    await appDatabase.jobs.create(job);
    revalidatePath('/jobs');
    revalidatePath('/');
}

export async function getPendingBackgroundWorkCount(): Promise<{ pendingJobs: number, retryingSessions: number }> {
    const pendingJobs = await db.select().from(schema.jobs).where(
        or(eq(schema.jobs.status, 'PENDING'), eq(schema.jobs.status, 'PROCESSING'))
    );

    // For retrying sessions, we want sessions that are FAILED and have retries left (retryCount < maxRetries)
    // AND probably where last error was recoverable?
    // We'll simplify and count FAILED sessions that have retryCount < 50 (since max could be 50).
    // Or we could try to be more specific.
    // The requirement says "failed due to 'too many requests' error, we will keep retrying it for 50 times. Otherwise... 3 times."

    const failedSessions = await db.select().from(schema.sessions).where(eq(schema.sessions.state, 'FAILED'));
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
    return appDatabase.predefinedPrompts.getAll();
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    // This is not efficient, but for this small scale it is fine.
    // A better implementation would be to diff the arrays.
    db.transaction((tx) => {
        tx.delete(schema.predefinedPrompts).run();
        if (prompts.length > 0) {
            tx.insert(schema.predefinedPrompts).values(prompts).run();
        }
    });
    revalidatePath('/settings');
}

// --- History Prompts ---
export async function getHistoryPrompts(): Promise<HistoryPrompt[]> {
    const settings = await db.select().from(schema.settings).get();
    const limit = settings?.historyPromptsCount ?? 10;
    return appDatabase.historyPrompts.getRecent(limit);
}

export async function saveHistoryPrompt(promptText: string): Promise<void> {
    if (!promptText.trim()) return;

    // Check if prompt already exists
    const existing = await db.select().from(schema.historyPrompts).where(eq(schema.historyPrompts.prompt, promptText)).get();

    if (existing) {
        await appDatabase.historyPrompts.update(existing.id, { lastUsedAt: new Date().toISOString() });
    } else {
        const newHistoryPrompt: HistoryPrompt = {
            id: crypto.randomUUID(),
            prompt: promptText,
            lastUsedAt: new Date().toISOString()
        };
        await appDatabase.historyPrompts.create(newHistoryPrompt);
    }

    revalidatePath('/');
}

// --- Quick Replies ---
export async function getQuickReplies(): Promise<PredefinedPrompt[]> {
    return appDatabase.quickReplies.getAll();
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    // This is not efficient, but for this small scale it is fine.
    db.transaction((tx) => {
        tx.delete(schema.quickReplies).run();
        if (replies.length > 0) {
            tx.insert(schema.quickReplies).values(replies).run();
        }
    });
    revalidatePath('/settings');
}

// --- Global Prompt ---
export async function getGlobalPrompt(): Promise<string> {
    const result = await appDatabase.globalPrompt.get();
    return result?.prompt ?? "";
}

export async function saveGlobalPrompt(prompt: string): Promise<void> {
    await appDatabase.globalPrompt.save(prompt);
    revalidatePath('/settings');
}

// --- Repo Prompt ---
export async function getRepoPrompt(repo: string): Promise<string> {
    const result = await appDatabase.repoPrompts.get(repo);
    return result?.prompt ?? "";
}

export async function saveRepoPrompt(repo: string, prompt: string): Promise<void> {
    await appDatabase.repoPrompts.save(repo, prompt);
    revalidatePath('/settings');
}

// --- Profiles ---
export async function getProfiles() {
    return db.query.profiles.findMany();
}

export async function createProfile(name: string) {
    const activeProfile = await db.query.profiles.findFirst({ where: eq(schema.profiles.isActive, true) });
    if (!activeProfile) {
        throw new Error('No active profile found.');
    }
    const activeSettings = await db.query.settings.findFirst({ where: eq(schema.settings.profileId, activeProfile.id) });
    const newProfile = { id: crypto.randomUUID(), name, isActive: false };
    await db.insert(schema.profiles).values(newProfile);
    await db.insert(schema.settings).values({ ...activeSettings, id: undefined, profileId: newProfile.id });
    revalidatePath('/settings');
}

export async function renameProfile(id: string, name: string) {
    await db.update(schema.profiles).set({ name }).where(eq(schema.profiles.id, id));
    revalidatePath('/settings');
}

export async function deleteProfile(id: string) {
    const allProfiles = await db.query.profiles.findMany();
    if (allProfiles.length <= 1) {
        throw new Error('Cannot delete the last profile.');
    }
    const profile = await db.query.profiles.findFirst({ where: eq(schema.profiles.id, id) });
    if (profile?.isActive) {
        throw new Error('Cannot delete the active profile.');
    }
    await db.transaction(async (tx) => {
        await tx.delete(schema.settings).where(eq(schema.settings.profileId, id));
        await tx.delete(schema.profiles).where(eq(schema.profiles.id, id));
    });
    revalidatePath('/settings');
}

export async function setActiveProfile(id: string) {
    const currentActive = await db.query.profiles.findFirst({ where: eq(schema.profiles.isActive, true) });
    if (currentActive?.id === id) {
        return; // Profile is already active
    }
    await db.transaction(async (tx) => {
        if (currentActive) {
            await tx.update(schema.profiles).set({ isActive: false }).where(eq(schema.profiles.id, currentActive.id));
        }
        await tx.update(schema.profiles).set({ isActive: true }).where(eq(schema.profiles.id, id));
    });
    revalidatePath('/settings');
}

// --- Settings ---
export async function getSettings() {
    const activeProfile = await db.query.profiles.findFirst({ where: eq(schema.profiles.isActive, true) });
    if (!activeProfile) {
        // Create a default profile if none exists
        const defaultProfile = { id: 'default', name: 'Default', isActive: true };
        await db.insert(schema.profiles).values(defaultProfile);
        const defaultSettings = { profileId: 'default' };
        await db.insert(schema.settings).values(defaultSettings);
        return db.query.settings.findFirst({ where: eq(schema.settings.profileId, 'default') });
    }
    return db.query.settings.findFirst({ where: eq(schema.settings.profileId, activeProfile.id) });
}
