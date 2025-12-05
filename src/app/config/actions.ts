
'use server';

import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import type { Job, PredefinedPrompt, HistoryPrompt, Settings } from '@/lib/types';
import { revalidatePath } from 'next/cache';
<<<<<<< HEAD
import { eq, desc, or } from 'drizzle-orm';
=======
import { eq, desc, and } from 'drizzle-orm';
>>>>>>> 4d52d8a (Apply patch /tmp/a95fca6f-c2d6-4225-a184-e2348dbb7295.patch)

// --- Jobs ---
export async function getJobs(profileId?: string): Promise<Job[]> {
    return appDatabase.jobs.getAll(profileId);
}

export async function addJob(job: Job): Promise<void> {
    await appDatabase.jobs.create(job);
    revalidatePath('/jobs');
    revalidatePath('/');
}

<<<<<<< HEAD
export async function getPendingBackgroundWorkCount(): Promise<{ pendingJobs: number, retryingSessions: number }> {
    const pendingJobs = await db.select().from(schema.jobs).where(
        or(eq(schema.jobs.status, 'PENDING'), eq(schema.jobs.status, 'PROCESSING'))
    );
=======
export async function getPendingBackgroundWorkCount(profileId?: string): Promise<{ pendingJobs: number, retryingSessions: number }> {
    let pendingJobsQuery = db.select().from(schema.jobs).where(eq(schema.jobs.status, 'PENDING'));
    if (profileId) {
        pendingJobsQuery = pendingJobsQuery.where(eq(schema.jobs.profileId, profileId));
    }
    const pendingJobs = await pendingJobsQuery;
>>>>>>> 4d52d8a (Apply patch /tmp/a95fca6f-c2d6-4225-a184-e2348dbb7295.patch)

    // For retrying sessions, we want sessions that are FAILED and have retries left (retryCount < maxRetries)
    // AND probably where last error was recoverable?
    // We'll simplify and count FAILED sessions that have retryCount < 50 (since max could be 50).
    // Or we could try to be more specific.
    // The requirement says "failed due to 'too many requests' error, we will keep retrying it for 50 times. Otherwise... 3 times."

    let failedSessionsQuery = db.select().from(schema.sessions).where(eq(schema.sessions.state, 'FAILED'));
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
export async function getPredefinedPrompts(profileId?: string): Promise<PredefinedPrompt[]> {
    return appDatabase.predefinedPrompts.getAll(profileId);
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[], profileId: string): Promise<void> {
    // This is not efficient, but for this small scale it is fine.
    // A better implementation would be to diff the arrays.

    // We need to ensure we only delete prompts for the specific profile
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
export async function getHistoryPrompts(profileId?: string): Promise<HistoryPrompt[]> {
    let settings: Settings | undefined;
    if (profileId) {
         settings = await db.select().from(schema.settings).where(eq(schema.settings.profileId, profileId)).get();
    } else {
         // Fallback to getting a random setting or 'default' if we assume global
         // For now let's just use default limit
         settings = await db.select().from(schema.settings).limit(1).get();
    }
    const limit = settings?.historyPromptsCount ?? 10;
    return appDatabase.historyPrompts.getRecent(limit, profileId);
}

export async function saveHistoryPrompt(promptText: string, profileId: string): Promise<void> {
    if (!promptText.trim()) return;

    // Check if prompt already exists for this profile
    const existing = await db.select().from(schema.historyPrompts)
        .where(
            and(
                eq(schema.historyPrompts.prompt, promptText),
                eq(schema.historyPrompts.profileId, profileId)
            )
        )
        .get();

    if (existing) {
        await appDatabase.historyPrompts.update(existing.id, { lastUsedAt: new Date().toISOString() });
    } else {
        const newHistoryPrompt: HistoryPrompt = {
            id: crypto.randomUUID(),
            prompt: promptText,
            lastUsedAt: new Date().toISOString(),
            // @ts-ignore
            profileId: profileId
        };
        await appDatabase.historyPrompts.create(newHistoryPrompt);
    }

    revalidatePath('/');
}

// --- Quick Replies ---
export async function getQuickReplies(profileId?: string): Promise<PredefinedPrompt[]> {
    return appDatabase.quickReplies.getAll(profileId);
}

export async function saveQuickReplies(replies: PredefinedPrompt[], profileId: string): Promise<void> {
    // This is not efficient, but for this small scale it is fine.
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
export async function getGlobalPrompt(profileId?: string): Promise<string> {
    const result = await appDatabase.globalPrompt.get(profileId);
    return result?.prompt ?? "";
}

export async function saveGlobalPrompt(prompt: string, profileId: string): Promise<void> {
    await appDatabase.globalPrompt.save(prompt, profileId);
    revalidatePath('/settings');
}

// --- Repo Prompt ---
export async function getRepoPrompt(repo: string, profileId?: string): Promise<string> {
    if (!profileId) return ""; // Cannot get repo prompt without profile context
    const result = await appDatabase.repoPrompts.get(repo, profileId);
    return result?.prompt ?? "";
}

export async function saveRepoPrompt(repo: string, prompt: string, profileId: string): Promise<void> {
    await appDatabase.repoPrompts.save(repo, prompt, profileId);
    revalidatePath('/settings');
}

// --- Settings ---
export async function getSettings(profileId?: string) {
    if (profileId) {
        return db.select().from(schema.settings).where(eq(schema.settings.profileId, profileId)).get();
    }
    return db.query.settings.findFirst();
}
