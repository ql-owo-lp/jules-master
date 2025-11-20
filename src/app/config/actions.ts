
'use server';

import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import type { Job, PredefinedPrompt } from '@/lib/types';
import { revalidatePath } from 'next/cache';

// --- Jobs ---
export async function getJobs(): Promise<Job[]> {
    return appDatabase.jobs.getAll();
}

export async function addJob(job: Job): Promise<void> {
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
    await db.delete(schema.predefinedPrompts);
    if (prompts.length > 0) {
        await appDatabase.predefinedPrompts.createMany(prompts);
    }
    revalidatePath('/prompts');
}


// --- Quick Replies ---
export async function getQuickReplies(): Promise<PredefinedPrompt[]> {
    return appDatabase.quickReplies.getAll();
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    // This is not efficient, but for this small scale it is fine.
    await db.delete(schema.quickReplies);
    if (replies.length > 0) {
       await appDatabase.quickReplies.createMany(replies);
    }
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
