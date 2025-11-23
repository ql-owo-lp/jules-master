
'use server';

import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import type { Job, PredefinedPrompt, HistoryPrompt } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { eq, desc } from 'drizzle-orm';

// --- Jobs ---
// --- Mock Data ---
let MOCK_JOBS: Job[] = [];

export async function resetMockJobs() {
    MOCK_JOBS = [];
}

export async function getJobs(): Promise<Job[]> {
    if (process.env.MOCK_API === 'true') {
        return MOCK_JOBS;
    }
    return appDatabase.jobs.getAll();
}

export async function addJob(job: Job): Promise<void> {
    if (process.env.MOCK_API === 'true') {
        MOCK_JOBS.push(job);
        return;
    }
    await appDatabase.jobs.create(job);
    revalidatePath('/jobs');
    revalidatePath('/');
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
    revalidatePath('/prompts');
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
    revalidatePath('/prompts');
}

// --- Global Prompt ---
export async function getGlobalPrompt(): Promise<string> {
    const result = await appDatabase.globalPrompt.get();
    return result?.prompt ?? "";
}

export async function saveGlobalPrompt(prompt: string): Promise<void> {
    await appDatabase.globalPrompt.save(prompt);
    revalidatePath('/prompts');
}
