
'use server';

import type { Job, PredefinedPrompt } from '@/lib/types';
import { SqliteDao } from '@/lib/sqlite-dao';
import type { Dao } from '@/lib/dao';

const dao: Dao = new SqliteDao();

// --- Jobs ---
export async function getJobs(): Promise<Job[]> {
    return dao.getJobs();
}

export async function addJob(job: Job): Promise<void> {
    await dao.addJob(job);
}

// --- Predefined Prompts ---
export async function getPredefinedPrompts(): Promise<PredefinedPrompt[]> {
    return dao.getPredefinedPrompts();
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    await dao.savePredefinedPrompts(prompts);
}


// --- Quick Replies ---
export async function getQuickReplies(): Promise<PredefinedPrompt[]> {
    return dao.getQuickReplies();
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    await dao.saveQuickReplies(replies);
}

// --- Global Prompt ---
export async function getGlobalPrompt(): Promise<string> {
    return dao.getGlobalPrompt();
}

export async function saveGlobalPrompt(prompt: string): Promise<void> {
    await dao.saveGlobalPrompt(prompt);
}
