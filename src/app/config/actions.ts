
'use server';

import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import type { Job, PredefinedPrompt, HistoryPrompt } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { eq, desc } from 'drizzle-orm';

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
    const pendingJobs = await db.select().from(schema.jobs).where(eq(schema.jobs.status, 'PENDING'));

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

// --- Settings ---
export async function getSettings() {
    return db.query.settings.findFirst();
}
