
'use server';

import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import type { Job, PredefinedPrompt, HistoryPrompt } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { eq, desc, and } from 'drizzle-orm';
import { cookies } from 'next/headers';

async function getProfileId() {
    const cookieStore = await cookies();
    let id = cookieStore.get('jules-current-profile-id')?.value;
    if (!id) {
        // Fallback to the first profile if no cookie is set (e.g. single user mode or initial load)
        const defaultProfile = await db.select().from(schema.profiles).limit(1).get();
        id = defaultProfile?.id;
    }
    return id;
}

// --- Jobs ---
export async function getJobs(): Promise<Job[]> {
    const profileId = await getProfileId();
    return appDatabase.jobs.getAll(profileId);
}

export async function addJob(job: Job): Promise<void> {
    const profileId = await getProfileId();
    // Ensure profileId is set
    job.profileId = profileId;
    await appDatabase.jobs.create(job);
    revalidatePath('/jobs');
    revalidatePath('/');
}

export async function getPendingBackgroundWorkCount(): Promise<{ pendingJobs: number, retryingSessions: number }> {
    const profileId = await getProfileId();

    // We should probably allow background worker to see ALL jobs?
    // But if this is for UI display, it should be scoped.
    // If it's for the actual worker, the worker might not use this action.
    // Assuming this is for UI badge/status.

    let pendingJobsQuery = db.select().from(schema.jobs).where(eq(schema.jobs.status, 'PENDING'));
    if (profileId) {
        pendingJobsQuery = pendingJobsQuery.where(eq(schema.jobs.profileId, profileId));
    }
    const pendingJobs = await pendingJobsQuery;

    let failedSessionsQuery = db.select().from(schema.sessions).where(eq(schema.sessions.state, 'FAILED'));
    // Sessions filter by profile? schema.sessions now has profileId (I added it to schema but did I remove the relation?)
    // Yes, sessions has profileId.
    if (profileId) {
        failedSessionsQuery = failedSessionsQuery.where(eq(schema.sessions.profileId, profileId));
    }
    const failedSessions = await failedSessionsQuery;

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
    const profileId = await getProfileId();
    return appDatabase.predefinedPrompts.getAll(profileId);
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    const profileId = await getProfileId();

    // Ensure profileId is set on all prompts
    const promptsWithProfile = prompts.map(p => ({ ...p, profileId }));

    // Transaction to replace prompts for this profile
    // Note: better-sqlite3 transactions are synchronous
    db.transaction((tx) => {
        // Delete existing prompts for this profile
        if (profileId) {
            tx.delete(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, profileId)).run();
        } else {
             throw new Error("No profile selected");
        }

        if (promptsWithProfile.length > 0) {
            tx.insert(schema.predefinedPrompts).values(promptsWithProfile).run();
        }
    });
    revalidatePath('/settings');
}

// --- History Prompts ---
export async function getHistoryPrompts(): Promise<HistoryPrompt[]> {
    const profileId = await getProfileId();

    // Get settings for profile to know count
    let limit = 10;
    if (profileId) {
        const settings = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).get();
        limit = settings?.historyPromptsCount ?? 10;
    } else {
         const settings = await db.select().from(schema.profiles).get(); // get any/first
         limit = settings?.historyPromptsCount ?? 10;
    }

    return appDatabase.historyPrompts.getRecent(limit, profileId);
}

export async function saveHistoryPrompt(promptText: string): Promise<void> {
    if (!promptText.trim()) return;
    const profileId = await getProfileId();

    // Check if prompt already exists for this profile
    let existingQuery = db.select().from(schema.historyPrompts).where(eq(schema.historyPrompts.prompt, promptText));
    if (profileId) {
        existingQuery = existingQuery.where(eq(schema.historyPrompts.profileId, profileId));
    }
    const existing = await existingQuery.get();

    if (existing) {
        await appDatabase.historyPrompts.update(existing.id, { lastUsedAt: new Date().toISOString() });
    } else {
        const newHistoryPrompt: HistoryPrompt = {
            id: crypto.randomUUID(),
            profileId,
            prompt: promptText,
            lastUsedAt: new Date().toISOString()
        };
        await appDatabase.historyPrompts.create(newHistoryPrompt);
    }

    revalidatePath('/');
}

// --- Quick Replies ---
export async function getQuickReplies(): Promise<PredefinedPrompt[]> {
    const profileId = await getProfileId();
    return appDatabase.quickReplies.getAll(profileId);
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    const profileId = await getProfileId();
    const repliesWithProfile = replies.map(r => ({ ...r, profileId }));

    db.transaction((tx) => {
         if (profileId) {
            tx.delete(schema.quickReplies).where(eq(schema.quickReplies.profileId, profileId)).run();
        } else {
             throw new Error("No profile selected");
        }

        if (repliesWithProfile.length > 0) {
            tx.insert(schema.quickReplies).values(repliesWithProfile).run();
        }
    });
    revalidatePath('/settings');
}

// --- Global Prompt ---
export async function getGlobalPrompt(): Promise<string> {
    const profileId = await getProfileId();
    const result = await appDatabase.globalPrompt.get(profileId);
    return result?.prompt ?? "";
}

export async function saveGlobalPrompt(prompt: string): Promise<void> {
    const profileId = await getProfileId();
    if (!profileId) throw new Error("No profile selected");
    await appDatabase.globalPrompt.save(profileId, prompt);
    revalidatePath('/settings');
}

// --- Repo Prompt ---
export async function getRepoPrompt(repo: string): Promise<string> {
    const profileId = await getProfileId();
    const result = await appDatabase.repoPrompts.get(repo, profileId);
    return result?.prompt ?? "";
}

export async function saveRepoPrompt(repo: string, prompt: string): Promise<void> {
    const profileId = await getProfileId();
    if (!profileId) throw new Error("No profile selected");
    await appDatabase.repoPrompts.save(repo, profileId, prompt);
    revalidatePath('/settings');
}

// --- Settings ---
// Deprecated or should use profiles
export async function getSettings() {
    const profileId = await getProfileId();
    if (profileId) {
        return db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).get();
    }
    return db.query.profiles.findFirst();
}
