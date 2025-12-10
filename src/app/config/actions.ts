
'use server';

import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import type { Job, PredefinedPrompt, HistoryPrompt } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { eq, desc, or, and } from 'drizzle-orm';

// --- Jobs ---
export async function getJobs(profileId: string = 'default'): Promise<Job[]> {
    const jobs = await db.select().from(schema.jobs).where(eq(schema.jobs.profileId, profileId)).all();
    return jobs.map(j => ({
        ...j,
        sessionIds: j.sessionIds || [],
        prompt: j.prompt || undefined,
        sessionCount: j.sessionCount ?? undefined,
        status: j.status || undefined,
        automationMode: j.automationMode || undefined,
        requirePlanApproval: j.requirePlanApproval ?? undefined
    }));
}

export async function addJob(job: Job): Promise<void> {
    const jobWithProfile = { ...job, profileId: job.profileId || 'default' };
    await appDatabase.jobs.create(jobWithProfile);
    revalidatePath('/jobs');
    revalidatePath('/');
}

export async function getPendingBackgroundWorkCount(profileId: string = 'default'): Promise<{ pendingJobs: number, retryingSessions: number }> {
    const pendingJobs = await db.select().from(schema.jobs).where(
        and(
            eq(schema.jobs.profileId, profileId),
            or(eq(schema.jobs.status, 'PENDING'), eq(schema.jobs.status, 'PROCESSING'))
        )
    );

    // For retrying sessions, we want sessions that are FAILED and have retries left (retryCount < maxRetries)
    // AND probably where last error was recoverable?
    // We'll simplify and count FAILED sessions that have retryCount < 50 (since max could be 50).
    // Or we could try to be more specific.
    // The requirement says "failed due to 'too many requests' error, we will keep retrying it for 50 times. Otherwise... 3 times."

    const failedSessions = await db.select().from(schema.sessions).where(and(eq(schema.sessions.state, 'FAILED'), eq(schema.sessions.profileId, profileId)));
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
export async function getPredefinedPrompts(profileId: string = 'default'): Promise<PredefinedPrompt[]> {
    return db.select().from(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, profileId)).all();
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    // This is not efficient, but for this small scale it is fine.
    // A better implementation would be to diff the arrays.
    // Ensure all prompts have the correct profileId
    const profileId = prompts.length > 0 ? prompts[0].profileId || 'default' : 'default'; // Assumption: batch save is for one profile

    db.transaction((tx) => {
        tx.delete(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, profileId)).run();
        if (prompts.length > 0) {
            const promptsWithProfile = prompts.map(p => ({ ...p, profileId }));
            tx.insert(schema.predefinedPrompts).values(promptsWithProfile).run();
        }
    });
    revalidatePath('/settings');
}

// --- History Prompts ---
export async function getHistoryPrompts(profileId: string = 'default'): Promise<HistoryPrompt[]> {
    const settings = await db.select().from(schema.settings).where(eq(schema.settings.profileId, profileId)).get();
    const limit = settings?.historyPromptsCount ?? 10;
    
    return db.select().from(schema.historyPrompts)
        .where(eq(schema.historyPrompts.profileId, profileId))
        .orderBy(desc(schema.historyPrompts.lastUsedAt))
        .limit(limit)
        .all();
}

export async function saveHistoryPrompt(promptText: string, profileId: string = 'default'): Promise<void> {
    if (!promptText.trim()) return;

    // Check if prompt already exists for this profile
    const existing = await db.select().from(schema.historyPrompts).where(
        and(eq(schema.historyPrompts.prompt, promptText), eq(schema.historyPrompts.profileId, profileId))
    ).get();

    if (existing) {
        // appDatabase helpers might not support profileId specific update easily if ID is not unique?
        // Actually historyPrompts has ID.
        await db.update(schema.historyPrompts).set({ lastUsedAt: new Date().toISOString() }).where(eq(schema.historyPrompts.id, existing.id)).run();
    } else {
        const newHistoryPrompt: HistoryPrompt = {
            id: crypto.randomUUID(),
            prompt: promptText,
            lastUsedAt: new Date().toISOString(),
            profileId
        };
        await db.insert(schema.historyPrompts).values(newHistoryPrompt).run();
    }

    revalidatePath('/');
}

// --- Quick Replies ---
export async function getQuickReplies(profileId: string = 'default'): Promise<PredefinedPrompt[]> {
    return db.select().from(schema.quickReplies).where(eq(schema.quickReplies.profileId, profileId)).all();
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    // This is not efficient, but for this small scale it is fine.
    const profileId = replies.length > 0 ? replies[0].profileId || 'default' : 'default';
    db.transaction((tx) => {
        tx.delete(schema.quickReplies).where(eq(schema.quickReplies.profileId, profileId)).run();
        if (replies.length > 0) {
            const repliesWithProfile = replies.map(r => ({ ...r, profileId }));
            tx.insert(schema.quickReplies).values(repliesWithProfile).run();
        }
    });
    revalidatePath('/settings');
}

// --- Global Prompt ---
export async function getGlobalPrompt(profileId: string = 'default'): Promise<string> {
    const result = await db.select().from(schema.globalPrompt).where(eq(schema.globalPrompt.profileId, profileId)).limit(1).get();
    return result?.prompt ?? "";
}

export async function saveGlobalPrompt(prompt: string, profileId: string = 'default'): Promise<void> {
    // Upsert logic for global prompt
    const existing = await db.select().from(schema.globalPrompt).where(eq(schema.globalPrompt.profileId, profileId)).get();
    if (existing) {
        await db.update(schema.globalPrompt).set({ prompt }).where(eq(schema.globalPrompt.profileId, profileId)).run();
    } else {
        await db.insert(schema.globalPrompt).values({ prompt, profileId }).run();
    }
    revalidatePath('/settings');
}

// --- Repo Prompt ---
export async function getRepoPrompt(repo: string, profileId: string = 'default'): Promise<string> {
    const result = await db.select().from(schema.repoPrompts).where(
        and(eq(schema.repoPrompts.repo, repo), eq(schema.repoPrompts.profileId, profileId))
    ).limit(1).get();
    return result?.prompt ?? "";
}

export async function saveRepoPrompt(repo: string, prompt: string, profileId: string = 'default'): Promise<void> {
    // Upsert
    const existing = await db.select().from(schema.repoPrompts).where(
        and(eq(schema.repoPrompts.repo, repo), eq(schema.repoPrompts.profileId, profileId))
    ).get();

    if (existing) {
        await db.update(schema.repoPrompts).set({ prompt }).where(
            and(eq(schema.repoPrompts.repo, repo), eq(schema.repoPrompts.profileId, profileId))
        ).run();
    } else {
        await db.insert(schema.repoPrompts).values({ repo, prompt, profileId }).run();
    }
    revalidatePath('/settings');
}

// --- Settings ---
export async function getSettings(profileId: string = 'default') {
    return db.query.settings.findFirst({ where: eq(schema.settings.profileId, profileId) });
}
