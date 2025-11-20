
'use server';

import { appDatabase } from '@/lib/db';
import type { Job, PredefinedPrompt } from '@/lib/types';

// --- Jobs ---
export async function getJobs(): Promise<Job[]> {
    return appDatabase.jobs.getAll();
}

export async function addJob(job: Job): Promise<void> {
    await appDatabase.jobs.create(job);
}

// --- Predefined Prompts ---
export async function getPredefinedPrompts(): Promise<PredefinedPrompt[]> {
    return appDatabase.predefinedPrompts.getAll();
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    await appDatabase.predefinedPrompts.createMany(prompts);
}


// --- Quick Replies ---
export async function getQuickReplies(): Promise<PredefinedPrompt[]> {
    return appDatabase.quickReplies.getAll();
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    await appDatabase.quickReplies.createMany(replies);
}

// --- Global Prompt ---
export async function getGlobalPrompt(): Promise<string> {
    const result = await appDatabase.globalPrompt.get();
    return result?.prompt ?? "";
}

export async function saveGlobalPrompt(prompt: string): Promise<void> {
    await appDatabase.globalPrompt.save(prompt);
}
