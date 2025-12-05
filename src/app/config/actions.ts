
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
    return appDatabase.jobs.getPendingWorkCount();
}

// --- Predefined Prompts ---
export async function getPredefinedPrompts(): Promise<PredefinedPrompt[]> {
    return appDatabase.predefinedPrompts.getAll();
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    const existing = await appDatabase.predefinedPrompts.getAll();
    const existingIds = existing.map(p => p.id);

    // Delete existing ones
    for (const id of existingIds) {
        await appDatabase.predefinedPrompts.delete(id);
    }

    // Insert new ones
    if (prompts.length > 0) {
        await appDatabase.predefinedPrompts.createMany(prompts);
    }

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

    const allHistory = await appDatabase.historyPrompts.getAll();
    const existing = allHistory.find(p => p.prompt === promptText);

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
    const existing = await appDatabase.quickReplies.getAll();
    const existingIds = existing.map(p => p.id);

    for (const id of existingIds) {
        await appDatabase.quickReplies.delete(id);
    }

    if (replies.length > 0) {
        await appDatabase.quickReplies.createMany(replies);
    }
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
