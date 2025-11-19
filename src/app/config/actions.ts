'use server';

import fs from 'fs/promises';
import path from 'path';
import type { Job, PredefinedPrompt } from '@/lib/types';

type UserConfig = {
    jobs: Job[];
    predefinedPrompts: PredefinedPrompt[];
    quickReplies: PredefinedPrompt[];
    globalPrompt: string;
};

const configPath = path.join(process.cwd(), 'src', 'data', 'user-config.json');

async function readConfig(): Promise<UserConfig> {
    try {
        const fileContent = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        // If file doesn't exist or is invalid, return default
        return {
            jobs: [],
            predefinedPrompts: [],
            quickReplies: [],
            globalPrompt: ''
        };
    }
}

async function writeConfig(config: UserConfig): Promise<void> {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

// --- Jobs ---
export async function getJobs(): Promise<Job[]> {
    const config = await readConfig();
    return config.jobs || [];
}

export async function addJob(job: Job): Promise<void> {
    const config = await readConfig();
    config.jobs = [...(config.jobs || []), job];
    await writeConfig(config);
}

// --- Predefined Prompts ---
export async function getPredefinedPrompts(): Promise<PredefinedPrompt[]> {
    const config = await readConfig();
    return config.predefinedPrompts || [];
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    const config = await readConfig();
    config.predefinedPrompts = prompts;
    await writeConfig(config);
}


// --- Quick Replies ---
export async function getQuickReplies(): Promise<PredefinedPrompt[]> {
    const config = await readConfig();
    return config.quickReplies || [];
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    const config = await readConfig();
    config.quickReplies = replies;
    await writeConfig(config);
}

// --- Global Prompt ---
export async function getGlobalPrompt(): Promise<string> {
    const config = await readConfig();
    return config.globalPrompt || "";
}

export async function saveGlobalPrompt(prompt: string): Promise<void> {
    const config = await readConfig();
    config.globalPrompt = prompt;
    await writeConfig(config);
}
