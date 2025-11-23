
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
    getJobs, addJob,
    getPredefinedPrompts, savePredefinedPrompts,
    getQuickReplies, saveQuickReplies,
    getGlobalPrompt, saveGlobalPrompt,
    getHistoryPrompts
} from '../src/app/config/actions';
import { Job, PredefinedPrompt, HistoryPrompt } from '../src/lib/types';
import { db } from '../src/lib/db';
import { jobs, predefinedPrompts, quickReplies, globalPrompt, historyPrompts, settings } from '../src/lib/db/schema';

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Config Actions', () => {
    beforeAll(async () => {
        // Clear all tables before running the tests
        await db.delete(jobs);
        await db.delete(predefinedPrompts);
        await db.delete(quickReplies);
        await db.delete(globalPrompt);
    });

    afterAll(async () => {
        // Clear all tables after running the tests
        await db.delete(jobs);
        await db.delete(predefinedPrompts);
        await db.delete(quickReplies);
        await db.delete(globalPrompt);
    });

    describe('Jobs', () => {
        beforeEach(async () => {
            await db.delete(jobs);
        });

        it('should add a and retrieve a job using actions', async () => {
            const newJob: Job = {
                id: '2',
                name: 'Test Action Job',
                sessionIds: ['session2'],
                createdAt: new Date().toISOString(),
                repo: 'test/repo',
                branch: 'main',
            };

            await addJob(newJob);
            const retrievedJobs = await getJobs();

            expect(retrievedJobs).toBeDefined();
            expect(retrievedJobs.length).toBe(1);
            expect(retrievedJobs[0].name).toBe('Test Action Job');
        });
    });

    describe('Predefined Prompts', () => {
        beforeEach(async () => {
            await db.delete(predefinedPrompts);
        });

        it('should save and retrieve predefined prompts', async () => {
            const prompts: PredefinedPrompt[] = [
                { id: 'p1', title: 'T1', prompt: 'P1' },
                { id: 'p2', title: 'T2', prompt: 'P2' }
            ];

            await savePredefinedPrompts(prompts);
            const retrieved = await getPredefinedPrompts();

            expect(retrieved).toHaveLength(2);
            expect(retrieved.find(p => p.id === 'p1')).toBeDefined();
        });

        it('should replace existing predefined prompts', async () => {
            const initialPrompts: PredefinedPrompt[] = [
                { id: 'p1', title: 'T1', prompt: 'P1' }
            ];
            await savePredefinedPrompts(initialPrompts);

            const newPrompts: PredefinedPrompt[] = [
                { id: 'p3', title: 'T3', prompt: 'P3' }
            ];
            await savePredefinedPrompts(newPrompts);

            const retrieved = await getPredefinedPrompts();
            expect(retrieved).toHaveLength(1);
            expect(retrieved[0].id).toBe('p3');
        });

        it('should handle empty array save', async () => {
            const initialPrompts: PredefinedPrompt[] = [
                { id: 'p1', title: 'T1', prompt: 'P1' }
            ];
            await savePredefinedPrompts(initialPrompts);
            await savePredefinedPrompts([]);

            const retrieved = await getPredefinedPrompts();
            expect(retrieved).toHaveLength(0);
        });
    });

    describe('Quick Replies', () => {
        beforeEach(async () => {
            await db.delete(quickReplies);
        });

        it('should save and retrieve quick replies', async () => {
             const replies: PredefinedPrompt[] = [
                { id: 'q1', title: 'R1', prompt: 'C1' },
                { id: 'q2', title: 'R2', prompt: 'C2' }
            ];

            await saveQuickReplies(replies);
            const retrieved = await getQuickReplies();

            expect(retrieved).toHaveLength(2);
            expect(retrieved.find(r => r.id === 'q1')).toBeDefined();
        });

        it('should replace existing quick replies', async () => {
             const initialReplies: PredefinedPrompt[] = [
                { id: 'q1', title: 'R1', prompt: 'C1' }
            ];
            await saveQuickReplies(initialReplies);

            const newReplies: PredefinedPrompt[] = [
                { id: 'q3', title: 'R3', prompt: 'C3' }
            ];
            await saveQuickReplies(newReplies);

            const retrieved = await getQuickReplies();
            expect(retrieved).toHaveLength(1);
            expect(retrieved[0].id).toBe('q3');
        });
    });

    describe('Global Prompt', () => {
        beforeEach(async () => {
            await db.delete(globalPrompt);
        });

        it('should save and retrieve global prompt', async () => {
            await saveGlobalPrompt('Global 1');
            const retrieved = await getGlobalPrompt();
            expect(retrieved).toBe('Global 1');
        });

        it('should update global prompt', async () => {
            await saveGlobalPrompt('Global 1');
            await saveGlobalPrompt('Global 2');
            const retrieved = await getGlobalPrompt();
            expect(retrieved).toBe('Global 2');
        });

         it('should return empty string if no global prompt set', async () => {
            const retrieved = await getGlobalPrompt();
            expect(retrieved).toBe('');
        });
    });

    describe('History Prompts', () => {
        beforeEach(async () => {
            await db.delete(historyPrompts);
            await db.delete(settings);
        });

        it('should retrieve history prompts with default limit when no settings', async () => {
            for (let i = 0; i < 15; i++) {
                await db.insert(historyPrompts).values({ id: `h${i}`, prompt: `History ${i}`, lastUsedAt: new Date().toISOString() });
            }

            const retrieved = await getHistoryPrompts();
            expect(retrieved).toHaveLength(10);
        });
    });
});
