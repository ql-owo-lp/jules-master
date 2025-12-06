
'use server';

import { appDatabase, db, getActiveProfileId } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import type { Job, PredefinedPrompt, HistoryPrompt } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { eq, desc, or, and } from 'drizzle-orm';

// --- Profiles ---
export async function getProfiles() {
    return db.select().from(schema.profiles).orderBy(desc(schema.profiles.updatedAt));
}

export async function createProfile(name: string) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(schema.profiles).values({
        id,
        name,
        isActive: false, // Created profiles are not active by default
        createdAt: now,
        updatedAt: now,
    });
    await db.insert(schema.settings).values({ profileId: id });
    revalidatePath('/settings');
}

export async function renameProfile(id: string, name: string) {
    await db.update(schema.profiles).set({ name, updatedAt: new Date().toISOString() }).where(eq(schema.profiles.id, id));
    revalidatePath('/settings');
}

export async function setActiveProfile(id: string) {
    // Determine the current active profile first
    const currentActive = await db.select().from(schema.profiles).where(eq(schema.profiles.isActive, true)).get();

    // Deactivate current active profile
    if (currentActive) {
        await db.update(schema.profiles).set({ isActive: false }).where(eq(schema.profiles.id, currentActive.id));
    }

    // Activate new profile
    await db.update(schema.profiles).set({ isActive: true, updatedAt: new Date().toISOString() }).where(eq(schema.profiles.id, id));
    revalidatePath('/settings');
    revalidatePath('/'); // Refresh everything
}

// Ensure there is at least one profile
export async function deleteProfile(id: string) {
    const allProfiles = await db.select().from(schema.profiles);
    if (allProfiles.length <= 1) {
        throw new Error("Cannot delete the last profile.");
    }

    const profileToDelete = allProfiles.find(p => p.id === id);
    if (profileToDelete?.isActive) {
         throw new Error("Cannot delete the active profile. Please switch to another profile first.");
    }

    // Cascade delete related data (if not handled by DB constraints, which it isn't completely here for SQLite)
    // We should probably delete related rows
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
    const profileId = await getActiveProfileId();
    const pendingJobs = await db.select().from(schema.jobs).where(
        and(
            eq(schema.jobs.profileId, profileId),
            or(eq(schema.jobs.status, 'PENDING'), eq(schema.jobs.status, 'PROCESSING'))
        )
    );

    // For retrying sessions, we want sessions that are FAILED and have retries left (retryCount < maxRetries)
    // AND probably where last error was recoverable?
    // We'll simplify and count FAILED sessions that have retryCount < 50 (since max could be 50).
    // Or we could try to be more specific.
    // The requirement says "failed due to 'too many requests' error, we will keep retrying it for 50 times. Otherwise... 3 times."

    const failedSessions = await db.select().from(schema.sessions).where(
        and(
            eq(schema.sessions.profileId, profileId),
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
    return appDatabase.predefinedPrompts.getAll();
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    // This is not efficient, but for this small scale it is fine.
    // A better implementation would be to diff the arrays.
    // NOTE: appDatabase.predefinedPrompts.createMany handles profileId, but delete needs to be profile aware.
    // Actually, savePredefinedPrompts in previous implementation was deleting *all* rows and re-inserting.
    // We need to only delete for current profile.
    const profileId = await getActiveProfileId();

    db.transaction((tx) => {
        tx.delete(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, profileId)).run();
        if (prompts.length > 0) {
            const promptsWithProfile = prompts.map(p => ({ ...p, profileId }));
            tx.insert(schema.predefinedPrompts).values(promptsWithProfile).run();
        }
    });
    revalidatePath('/settings');
}

// --- History Prompts ---
export async function getHistoryPrompts(): Promise<HistoryPrompt[]> {
    const profileId = await getActiveProfileId();
    const settings = await db.select().from(schema.settings).where(eq(schema.settings.profileId, profileId)).get();
    const limit = settings?.historyPromptsCount ?? 10;
    return appDatabase.historyPrompts.getRecent(limit);
}

export async function saveHistoryPrompt(promptText: string): Promise<void> {
    if (!promptText.trim()) return;

    const profileId = await getActiveProfileId();

    // Check if prompt already exists
    const existing = await db.select().from(schema.historyPrompts).where(
        and(
            eq(schema.historyPrompts.prompt, promptText),
            eq(schema.historyPrompts.profileId, profileId)
        )
    ).get();

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
    const profileId = await getActiveProfileId();

    db.transaction((tx) => {
        tx.delete(schema.quickReplies).where(eq(schema.quickReplies.profileId, profileId)).run();
        if (replies.length > 0) {
            const repliesWithProfile = replies.map(r => ({ ...r, profileId }));
            tx.insert(schema.quickReplies).values(repliesWithProfile).run();
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

// --- Settings ---
export async function getSettings() {
    const profileId = await getActiveProfileId();
    return db.select().from(schema.settings).where(eq(schema.settings.profileId, profileId)).get();
}

// Also need to support updating settings including the credentials in the profiles table?
// The original code used /api/settings route which I need to check.
