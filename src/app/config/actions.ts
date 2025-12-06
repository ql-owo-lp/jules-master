
'use server';

import { appDatabase, db, getActiveProfileId } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import type { Job, PredefinedPrompt, HistoryPrompt } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { eq, desc, or, and } from 'drizzle-orm';

// --- Jobs ---
export async function getJobs(): Promise<Job[]> {
    const profileId = await getActiveProfileId();
    return appDatabase.jobs.getAll(profileId);
}

export async function addJob(job: Job): Promise<void> {
    const profileId = await getActiveProfileId();
    await appDatabase.jobs.create({ ...job, profileId });
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
    const profileId = await getActiveProfileId();
    return appDatabase.predefinedPrompts.getAll(profileId);
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    const profileId = await getActiveProfileId();
    // This is not efficient, but for this small scale it is fine.
    // A better implementation would be to diff the arrays.

    // BetterSQLite3 transactions must be synchronous.
    // Since we are running in a server action which is async, but using better-sqlite3 which is sync,
    // we can just run the transaction synchronously.

    db.transaction((tx) => {
        // Only delete prompts for this profile
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
    const settings = await db.query.settings.findFirst({
        where: eq(schema.settings.profileId, profileId)
    });
    const limit = settings?.historyPromptsCount ?? 10;
    return appDatabase.historyPrompts.getRecent(limit, profileId);
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
            lastUsedAt: new Date().toISOString(),
            profileId
        };
        await appDatabase.historyPrompts.create(newHistoryPrompt);
    }

    revalidatePath('/');
}

// --- Quick Replies ---
export async function getQuickReplies(): Promise<PredefinedPrompt[]> {
    const profileId = await getActiveProfileId();
    return appDatabase.quickReplies.getAll(profileId);
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    const profileId = await getActiveProfileId();
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
export async function getGlobalPrompt(): Promise<string> {
    const profileId = await getActiveProfileId();
    const result = await appDatabase.globalPrompt.get(profileId);
    return result?.prompt ?? "";
}

export async function saveGlobalPrompt(prompt: string): Promise<void> {
    const profileId = await getActiveProfileId();
    await appDatabase.globalPrompt.save(prompt, profileId);
    revalidatePath('/settings');
}

// --- Repo Prompt ---
export async function getRepoPrompt(repo: string): Promise<string> {
    const profileId = await getActiveProfileId();
    const result = await appDatabase.repoPrompts.get(repo, profileId);
    return result?.prompt ?? "";
}

export async function saveRepoPrompt(repo: string, prompt: string): Promise<void> {
    const profileId = await getActiveProfileId();
    await appDatabase.repoPrompts.save(repo, prompt, profileId);
    revalidatePath('/settings');
}

// --- Settings ---
export async function getSettings() {
    const profileId = await getActiveProfileId();
    return db.query.settings.findFirst({
        where: eq(schema.settings.profileId, profileId)
    });
}
