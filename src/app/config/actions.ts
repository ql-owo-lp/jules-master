
'use server';

import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { profileService } from '@/lib/db/profile-service';
import type { Job, PredefinedPrompt, HistoryPrompt } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { eq, desc, and } from 'drizzle-orm';

// --- Jobs ---
export async function getJobs(): Promise<Job[]> {
    const activeProfile = await profileService.getActiveProfile();
    return appDatabase.jobs.getAll(activeProfile.id);
}

export async function addJob(job: Job): Promise<void> {
    const activeProfile = await profileService.getActiveProfile();
    job.profileId = activeProfile.id;
    await appDatabase.jobs.create(job);
    revalidatePath('/jobs');
    revalidatePath('/');
}

export async function getPendingBackgroundWorkCount(): Promise<{ pendingJobs: number, retryingSessions: number }> {
    const activeProfile = await profileService.getActiveProfile();
    // Filter pending jobs by status and profileId using SQL
    const pendingJobs = await db.select().from(schema.jobs).where(
        and(
            eq(schema.jobs.status, 'PENDING'),
            eq(schema.jobs.profileId, activeProfile.id)
        )
    );

    // For retrying sessions, we want sessions that are FAILED and have retries left (retryCount < maxRetries)
    // We can also filter by profileId in SQL
    const failedSessions = await db.select().from(schema.sessions).where(
        and(
            eq(schema.sessions.state, 'FAILED'),
            eq(schema.sessions.profileId, activeProfile.id)
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
    const activeProfile = await profileService.getActiveProfile();
    return appDatabase.predefinedPrompts.getAll(activeProfile.id);
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    const activeProfile = await profileService.getActiveProfile();
    // This is not efficient, but for this small scale it is fine.
    // A better implementation would be to diff the arrays.
    db.transaction((tx) => {
        tx.delete(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, activeProfile.id)).run();
        if (prompts.length > 0) {
            const promptsWithProfile = prompts.map(p => ({ ...p, profileId: activeProfile.id }));
            tx.insert(schema.predefinedPrompts).values(promptsWithProfile).run();
        }
    });
    revalidatePath('/settings');
}

// --- History Prompts ---
export async function getHistoryPrompts(): Promise<HistoryPrompt[]> {
    const activeProfile = await profileService.getActiveProfile();
    const settings = await db.select().from(schema.settings).where(eq(schema.settings.profileId, activeProfile.id)).get();
    const limit = settings?.historyPromptsCount ?? 10;
    return appDatabase.historyPrompts.getRecent(limit, activeProfile.id);
}

export async function saveHistoryPrompt(promptText: string): Promise<void> {
    if (!promptText.trim()) return;
    const activeProfile = await profileService.getActiveProfile();

    // Check if prompt already exists
    // We filter by profileId and then check prompt match
    const existingMatch = await db.select().from(schema.historyPrompts).where(eq(schema.historyPrompts.profileId, activeProfile.id)).all();
    const match = existingMatch.find(p => p.prompt === promptText);

    if (match) {
        await appDatabase.historyPrompts.update(match.id, { lastUsedAt: new Date().toISOString() });
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
    const activeProfile = await profileService.getActiveProfile();
    return appDatabase.quickReplies.getAll(activeProfile.id);
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    const activeProfile = await profileService.getActiveProfile();
    // This is not efficient, but for this small scale it is fine.
    db.transaction((tx) => {
        tx.delete(schema.quickReplies).where(eq(schema.quickReplies.profileId, activeProfile.id)).run();
        if (replies.length > 0) {
            const repliesWithProfile = replies.map(r => ({ ...r, profileId: activeProfile.id }));
            tx.insert(schema.quickReplies).values(repliesWithProfile).run();
        }
    });
    revalidatePath('/settings');
}

// --- Global Prompt ---
export async function getGlobalPrompt(): Promise<string> {
    const activeProfile = await profileService.getActiveProfile();
    const result = await appDatabase.globalPrompt.get(activeProfile.id);
    return result?.prompt ?? "";
}

export async function saveGlobalPrompt(prompt: string): Promise<void> {
    const activeProfile = await profileService.getActiveProfile();
    await appDatabase.globalPrompt.save(prompt, activeProfile.id);
    revalidatePath('/settings');
}

// --- Repo Prompt ---
export async function getRepoPrompt(repo: string): Promise<string> {
    const activeProfile = await profileService.getActiveProfile();
    const result = await appDatabase.repoPrompts.get(repo, activeProfile.id);
    return result?.prompt ?? "";
}

export async function saveRepoPrompt(repo: string, prompt: string): Promise<void> {
    const activeProfile = await profileService.getActiveProfile();
    await appDatabase.repoPrompts.save(repo, prompt, activeProfile.id);
    revalidatePath('/settings');
}

// --- Settings ---
export async function getSettings() {
    const activeProfile = await profileService.getActiveProfile();
    return db.query.settings.findFirst({
        where: eq(schema.settings.profileId, activeProfile.id)
    });
}
