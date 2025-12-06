
'use server';

import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import type { Job, PredefinedPrompt, HistoryPrompt } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { eq, desc, or } from 'drizzle-orm';
import { getOrInitActiveProfileId } from '@/lib/profile-service';

// --- Jobs ---
export async function getJobs(): Promise<Job[]> {
    const profileId = await getOrInitActiveProfileId();
    return appDatabase.jobs.getAll(profileId);
}

export async function addJob(job: Job): Promise<void> {
    if (!job.profileId) {
        job.profileId = await getOrInitActiveProfileId();
    }
    await appDatabase.jobs.create(job);
    revalidatePath('/jobs');
    revalidatePath('/');
}

export async function getPendingBackgroundWorkCount(): Promise<{ pendingJobs: number, retryingSessions: number }> {
    const profileId = await getOrInitActiveProfileId();
    const pendingJobs = await db.select().from(schema.jobs).where(
        or(eq(schema.jobs.status, 'PENDING'), eq(schema.jobs.status, 'PROCESSING'))
    );

    // Filter pending jobs by profile
    const filteredPendingJobs = pendingJobs.filter(j => j.profileId === profileId);

    const failedSessions = await db.select().from(schema.sessions).where(eq(schema.sessions.state, 'FAILED'));
    const filteredFailedSessions = failedSessions.filter(s => s.profileId === profileId);

    let retryingSessionsCount = 0;

    for (const session of filteredFailedSessions) {
        const errorReason = session.lastError || "";
        const isRateLimit = errorReason.toLowerCase().includes("too many requests") || errorReason.includes("429");
        const maxRetries = isRateLimit ? 50 : 3;
        if ((session.retryCount || 0) < maxRetries) {
            retryingSessionsCount++;
        }
    }

    return {
        pendingJobs: filteredPendingJobs.length,
        retryingSessions: retryingSessionsCount
    };
}

// --- Predefined Prompts ---
export async function getPredefinedPrompts(): Promise<PredefinedPrompt[]> {
    const profileId = await getOrInitActiveProfileId();
    return appDatabase.predefinedPrompts.getAll(profileId);
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    const profileId = await getOrInitActiveProfileId();
    const promptsWithProfile = prompts.map(p => ({ ...p, profileId }));

    db.transaction((tx) => {
         tx.delete(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, profileId)).run();
         if (promptsWithProfile.length > 0) {
              tx.insert(schema.predefinedPrompts).values(promptsWithProfile).run();
         }
    });

    revalidatePath('/settings');
}

// --- History Prompts ---
export async function getHistoryPrompts(): Promise<HistoryPrompt[]> {
    const profileId = await getOrInitActiveProfileId();
    const settings = await db.select().from(schema.settings).where(eq(schema.settings.profileId, profileId)).get();
    const limit = settings?.historyPromptsCount ?? 10;
    return appDatabase.historyPrompts.getRecent(limit, profileId);
}

export async function saveHistoryPrompt(promptText: string): Promise<void> {
    if (!promptText.trim()) return;

    const profileId = await getOrInitActiveProfileId();

    // NOTE: We need to await the db.select() to get the array.
    // Drizzle behaves as thenable.
    const existingForProfile = await db.select().from(schema.historyPrompts)
        .where(
             or(
                 eq(schema.historyPrompts.prompt, promptText)
             )
        );

    // Let's verify `existingForProfile` is an array.
    if (Array.isArray(existingForProfile)) {
        const match = existingForProfile.find(p => p.profileId === profileId);

        if (match) {
            await appDatabase.historyPrompts.update(match.id, { lastUsedAt: new Date().toISOString() });
        } else {
            const newHistoryPrompt: HistoryPrompt = {
                id: crypto.randomUUID(),
                prompt: promptText,
                lastUsedAt: new Date().toISOString(),
                profileId
            };
            await appDatabase.historyPrompts.create(newHistoryPrompt);
        }
    } else {
        // Fallback or log error if it is not array (should not happen with await)
        console.error("saveHistoryPrompt: existingForProfile is not an array", existingForProfile);
    }

    revalidatePath('/');
}

// --- Quick Replies ---
export async function getQuickReplies(): Promise<PredefinedPrompt[]> {
    const profileId = await getOrInitActiveProfileId();
    return appDatabase.quickReplies.getAll(profileId);
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    const profileId = await getOrInitActiveProfileId();
    const repliesWithProfile = replies.map(r => ({ ...r, profileId }));

    db.transaction((tx) => {
        tx.delete(schema.quickReplies).where(eq(schema.quickReplies.profileId, profileId)).run();
        if (repliesWithProfile.length > 0) {
            tx.insert(schema.quickReplies).values(repliesWithProfile).run();
        }
    });

    revalidatePath('/settings');
}

// --- Global Prompt ---
export async function getGlobalPrompt(): Promise<string> {
    const profileId = await getOrInitActiveProfileId();
    const result = await appDatabase.globalPrompt.get(profileId);
    return result?.prompt ?? "";
}

export async function saveGlobalPrompt(prompt: string): Promise<void> {
    const profileId = await getOrInitActiveProfileId();
    await appDatabase.globalPrompt.save(prompt, profileId);
    revalidatePath('/settings');
}

// --- Repo Prompt ---
export async function getRepoPrompt(repo: string): Promise<string> {
    const profileId = await getOrInitActiveProfileId();
    const result = await appDatabase.repoPrompts.get(repo, profileId);
    return result?.prompt ?? "";
}

export async function saveRepoPrompt(repo: string, prompt: string): Promise<void> {
    const profileId = await getOrInitActiveProfileId();
    await appDatabase.repoPrompts.save(repo, prompt, profileId);
    revalidatePath('/settings');
}

// --- Settings ---
export async function getSettings() {
    const profileId = await getOrInitActiveProfileId();
    return db.query.settings.findFirst({
        where: eq(schema.settings.profileId, profileId)
    });
}
