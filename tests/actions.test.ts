
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
    getJobs, addJob,
    getPredefinedPrompts, savePredefinedPrompts,
    getQuickReplies, saveQuickReplies,
    getGlobalPrompt, saveGlobalPrompt,
    getHistoryPrompts, saveHistoryPrompt,
    getRepoPrompt, saveRepoPrompt
} from '../src/app/config/actions';
import { Job, PredefinedPrompt } from '../src/lib/types';
import { db } from '../src/lib/db';
import { jobs, predefinedPrompts, quickReplies, globalPrompt, historyPrompts, repoPrompts, profiles } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Config Actions', () => {
    const profileId = 'test-profile-actions';

    beforeAll(async () => {
        // Create a dummy profile
        await db.insert(profiles).values({ id: profileId, name: 'Test Profile', createdAt: new Date().toISOString() }).onConflictDoNothing();

        // Clear all tables before running the tests (filtered by profileId where possible, but here we clear everything for simplicity in this test file scope, or specific to profile)
        // Since we share DB, better to use profileId for all operations
        await db.delete(jobs).where(eq(jobs.profileId, profileId));
        await db.delete(predefinedPrompts).where(eq(predefinedPrompts.profileId, profileId));
        await db.delete(quickReplies).where(eq(quickReplies.profileId, profileId));
        await db.delete(globalPrompt).where(eq(globalPrompt.profileId, profileId));
        await db.delete(historyPrompts).where(eq(historyPrompts.profileId, profileId));
        await db.delete(repoPrompts).where(eq(repoPrompts.profileId, profileId));
    });

    afterAll(async () => {
        // Clear all tables after running the tests
        await db.delete(jobs).where(eq(jobs.profileId, profileId));
        await db.delete(predefinedPrompts).where(eq(predefinedPrompts.profileId, profileId));
        await db.delete(quickReplies).where(eq(quickReplies.profileId, profileId));
        await db.delete(globalPrompt).where(eq(globalPrompt.profileId, profileId));
        await db.delete(historyPrompts).where(eq(historyPrompts.profileId, profileId));
        await db.delete(repoPrompts).where(eq(repoPrompts.profileId, profileId));
        await db.delete(profiles).where(eq(profiles.id, profileId));
    });

    describe('Jobs', () => {
        beforeEach(async () => {
            await db.delete(jobs).where(eq(jobs.profileId, profileId));
        });

        it('should add a and retrieve a job using actions', async () => {
            const newJob: Job = {
                id: '2',
                name: 'Test Action Job',
                sessionIds: ['session2'],
                createdAt: new Date().toISOString(),
                repo: 'test/repo',
                branch: 'main',
                // @ts-ignore
                profileId: profileId,
            };

            await addJob(newJob);
            const retrievedJobs = await getJobs(profileId);

            expect(retrievedJobs).toBeDefined();
            expect(retrievedJobs.length).toBe(1);
            expect(retrievedJobs[0].name).toBe('Test Action Job');
        });
    });

    describe('Predefined Prompts', () => {
        beforeEach(async () => {
            await db.delete(predefinedPrompts).where(eq(predefinedPrompts.profileId, profileId));
        });

        it('should save and retrieve predefined prompts', async () => {
            const prompts: PredefinedPrompt[] = [
                { id: 'p1', title: 'T1', prompt: 'P1' },
                { id: 'p2', title: 'T2', prompt: 'P2' }
            ];

            await savePredefinedPrompts(prompts, profileId);
            const retrieved = await getPredefinedPrompts(profileId);

            expect(retrieved).toHaveLength(2);
            expect(retrieved.find(p => p.id === 'p1')).toBeDefined();
        });

        it('should replace existing predefined prompts', async () => {
            const initialPrompts: PredefinedPrompt[] = [
                { id: 'p1', title: 'T1', prompt: 'P1' }
            ];
            await savePredefinedPrompts(initialPrompts, profileId);

            const newPrompts: PredefinedPrompt[] = [
                { id: 'p3', title: 'T3', prompt: 'P3' }
            ];
            await savePredefinedPrompts(newPrompts, profileId);

            const retrieved = await getPredefinedPrompts(profileId);
            expect(retrieved).toHaveLength(1);
            expect(retrieved[0].id).toBe('p3');
        });

        it('should handle empty array save', async () => {
            const initialPrompts: PredefinedPrompt[] = [
                { id: 'p1', title: 'T1', prompt: 'P1' }
            ];
            await savePredefinedPrompts(initialPrompts, profileId);
            await savePredefinedPrompts([], profileId);

            const retrieved = await getPredefinedPrompts(profileId);
            expect(retrieved).toHaveLength(0);
        });
    });

    describe('Quick Replies', () => {
        beforeEach(async () => {
            await db.delete(quickReplies).where(eq(quickReplies.profileId, profileId));
        });

        it('should save and retrieve quick replies', async () => {
             const replies: PredefinedPrompt[] = [
                { id: 'q1', title: 'R1', prompt: 'C1' },
                { id: 'q2', title: 'R2', prompt: 'C2' }
            ];

            await saveQuickReplies(replies, profileId);
            const retrieved = await getQuickReplies(profileId);

            expect(retrieved).toHaveLength(2);
            expect(retrieved.find(r => r.id === 'q1')).toBeDefined();
        });

        it('should replace existing quick replies', async () => {
             const initialReplies: PredefinedPrompt[] = [
                { id: 'q1', title: 'R1', prompt: 'C1' }
            ];
            await saveQuickReplies(initialReplies, profileId);

            const newReplies: PredefinedPrompt[] = [
                { id: 'q3', title: 'R3', prompt: 'C3' }
            ];
            await saveQuickReplies(newReplies, profileId);

            const retrieved = await getQuickReplies(profileId);
            expect(retrieved).toHaveLength(1);
            expect(retrieved[0].id).toBe('q3');
        });
    });

    describe('Global Prompt', () => {
        beforeEach(async () => {
            await db.delete(globalPrompt).where(eq(globalPrompt.profileId, profileId));
        });

        it('should save and retrieve global prompt', async () => {
            await saveGlobalPrompt('Global 1', profileId);
            const retrieved = await getGlobalPrompt(profileId);
            expect(retrieved).toBe('Global 1');
        });

        it('should update global prompt', async () => {
            await saveGlobalPrompt('Global 1', profileId);
            await saveGlobalPrompt('Global 2', profileId);
            const retrieved = await getGlobalPrompt(profileId);
            expect(retrieved).toBe('Global 2');
        });

         it('should return empty string if no global prompt set', async () => {
            const retrieved = await getGlobalPrompt(profileId);
            expect(retrieved).toBe('');
        });
    });

    describe('History Prompts', () => {
        beforeEach(async () => {
            await db.delete(historyPrompts).where(eq(historyPrompts.profileId, profileId));
        });

        it('should save and retrieve history prompts', async () => {
            await saveHistoryPrompt('History 1', profileId);
            await saveHistoryPrompt('History 2', profileId);
            const retrieved = await getHistoryPrompts(profileId);
            expect(retrieved).toHaveLength(2);
            expect(retrieved.find(p => p.prompt === 'History 1')).toBeDefined();
        });

        it('should not save duplicate history prompts', async () => {
            await saveHistoryPrompt('History 1', profileId);
            await saveHistoryPrompt('History 1', profileId);
            const retrieved = await getHistoryPrompts(profileId);
            expect(retrieved).toHaveLength(1);
        });
    });

    describe('Repo Prompt', () => {
        beforeEach(async () => {
            await db.delete(repoPrompts).where(eq(repoPrompts.profileId, profileId));
        });

        it('should save and retrieve a repo-specific prompt', async () => {
            await saveRepoPrompt('user/repo1', 'Repo Prompt 1', profileId);
            const retrieved = await getRepoPrompt('user/repo1', profileId);
            expect(retrieved).toBe('Repo Prompt 1');
        });

        it('should return an empty string for a repo without a specific prompt', async () => {
            const retrieved = await getRepoPrompt('user/repo-unseen', profileId);
            expect(retrieved).toBe('');
        });

        it('should update an existing repo prompt', async () => {
            await saveRepoPrompt('user/repo1', 'Initial Prompt', profileId);
            await saveRepoPrompt('user/repo1', 'Updated Prompt', profileId);
            const retrieved = await getRepoPrompt('user/repo1', profileId);
            expect(retrieved).toBe('Updated Prompt');
        });
    });
});
