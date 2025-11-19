
'use server';

import { dao } from '@/lib/sqlite-dao';
import type { Job, PredefinedPrompt } from '@/lib/types';

// --- Jobs ---
export async function getJobs(): Promise<Job[]> {
  return await dao.getJobs();
}

export async function addJob(job: Job): Promise<void> {
  await dao.addJob(job);
}

// --- Predefined Prompts ---
export async function getPredefinedPrompts(): Promise<PredefinedPrompt[]> {
  return await dao.getPredefinedPrompts();
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
  await dao.savePredefinedPrompts(prompts);
}

// --- Quick Replies ---
export async function getQuickReplies(): Promise<PredefinedPrompt[]> {
  return await dao.getQuickReplies();
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
  await dao.saveQuickReplies(replies);
}

// --- Global Prompt ---
export async function getGlobalPrompt(): Promise<string> {
  return await dao.getGlobalPrompt();
}

export async function saveGlobalPrompt(prompt: string): Promise<void> {
  await dao.saveGlobalPrompt(prompt);
}
