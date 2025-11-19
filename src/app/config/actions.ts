
'use server';
console.log('Loading actions.ts');

import { dao } from '@/lib/sqlite-dao';
import type { Job, PredefinedPrompt } from '@/lib/types';

// --- Jobs ---
export async function getJobs(): Promise<Job[]> {
    return dao.getJobs();
}

export async function addJob(job: Job): Promise<void> {
    return dao.addJob(job);
}

// --- Predefined Prompts ---
export async function getPredefinedPrompts(): Promise<PredefinedPrompt[]> {
    return dao.getPredefinedPrompts();
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    return dao.savePredefinedPrompts(prompts);
}

// --- Quick Replies ---
export async function getQuickReplies(): Promise<PredefinedPrompt[]> {
    return dao.getQuickReplies();
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    return dao.saveQuickReplies(replies);
}

// --- Global Prompt ---
export async function getGlobalPrompt(): Promise<string> {
    return dao.getGlobalPrompt();
}

export async function saveGlobalPrompt(prompt: string): Promise<void> {
    return dao.saveGlobalPrompt(prompt);
}
