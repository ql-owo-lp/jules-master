
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { appDatabase } from '../src/lib/db';
import { Job, PredefinedPrompt } from '../src/lib/types';
import { db } from '../src/lib/db';
import { jobs, predefinedPrompts, quickReplies, globalPrompt, profiles } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Database Layer', () => {
    const profileId = 'test-profile-db';

    beforeAll(async () => {
        // Create a dummy profile
        await db.insert(profiles).values({ id: profileId, name: 'Test Profile', createdAt: new Date().toISOString() }).onConflictDoNothing();

        // Clear tables before running the tests
        await db.delete(jobs).where(eq(jobs.profileId, profileId));
        await db.delete(predefinedPrompts).where(eq(predefinedPrompts.profileId, profileId));
        await db.delete(quickReplies).where(eq(quickReplies.profileId, profileId));
        await db.delete(globalPrompt).where(eq(globalPrompt.profileId, profileId));
    });

    afterAll(async () => {
        // Clear tables after running the tests
        await db.delete(jobs).where(eq(jobs.profileId, profileId));
        await db.delete(predefinedPrompts).where(eq(predefinedPrompts.profileId, profileId));
        await db.delete(quickReplies).where(eq(quickReplies.profileId, profileId));
        await db.delete(globalPrompt).where(eq(globalPrompt.profileId, profileId));
        await db.delete(profiles).where(eq(profiles.id, profileId));
    });

    describe('Jobs DAO', () => {
        beforeEach(async () => {
            await db.delete(jobs).where(eq(jobs.profileId, profileId));
        });

        it('should create and retrieve a job', async () => {
            const newJob: Job = {
                id: '1',
                name: 'Test Job',
                sessionIds: ['session1'],
                createdAt: new Date().toISOString(),
                repo: 'test/repo',
                branch: 'main',
                // @ts-ignore
                profileId,
            };

            await appDatabase.jobs.create(newJob);
            const retrievedJob = await appDatabase.jobs.getById('1');

            expect(retrievedJob).toBeDefined();
            expect(retrievedJob?.name).toBe('Test Job');
        });

        it('should create many jobs', async () => {
            const jobList: Job[] = [
                {
                    id: '2',
                    name: 'Job 2',
                    sessionIds: [],
                    createdAt: new Date().toISOString(),
                    repo: 'test/repo',
                    branch: 'main',
                    // @ts-ignore
                    profileId,
                },
                {
                    id: '3',
                    name: 'Job 3',
                    sessionIds: [],
                    createdAt: new Date().toISOString(),
                    repo: 'test/repo',
                    branch: 'main',
                    // @ts-ignore
                    profileId,
                }
            ];

            await appDatabase.jobs.createMany(jobList);
            const allJobs = await appDatabase.jobs.getAll(profileId);
            expect(allJobs.length).toBe(2);
        });

        it('should update a job', async () => {
            const job: Job = {
                id: '4',
                name: 'Old Name',
                sessionIds: [],
                createdAt: new Date().toISOString(),
                repo: 'test/repo',
                branch: 'main',
                // @ts-ignore
                profileId,
            };
            await appDatabase.jobs.create(job);
            await appDatabase.jobs.update('4', { name: 'New Name' });

            const updated = await appDatabase.jobs.getById('4');
            expect(updated?.name).toBe('New Name');
        });

        it('should delete a job', async () => {
            const job: Job = {
                id: '5',
                name: 'To Delete',
                sessionIds: [],
                createdAt: new Date().toISOString(),
                repo: 'test/repo',
                branch: 'main',
                // @ts-ignore
                profileId,
            };
            await appDatabase.jobs.create(job);
            await appDatabase.jobs.delete('5');

            const deleted = await appDatabase.jobs.getById('5');
            expect(deleted).toBeUndefined();
        });
    });

    describe('PredefinedPrompts DAO', () => {
        beforeEach(async () => {
            await db.delete(predefinedPrompts).where(eq(predefinedPrompts.profileId, profileId));
        });

        it('should create and retrieve a predefined prompt', async () => {
            const prompt: PredefinedPrompt = {
                id: 'p1',
                title: 'Prompt 1',
                prompt: 'Content 1',
                // @ts-ignore
                profileId,
            };
            await appDatabase.predefinedPrompts.create(prompt);
            const retrieved = await appDatabase.predefinedPrompts.getById('p1');

            expect(retrieved).toBeDefined();
            expect(retrieved?.title).toBe('Prompt 1');
        });

        it('should create many predefined prompts', async () => {
            const prompts: PredefinedPrompt[] = [
                { id: 'p2', title: 'P2', prompt: 'C2', profileId },
                { id: 'p3', title: 'P3', prompt: 'C3', profileId }
            ] as any[];
            await appDatabase.predefinedPrompts.createMany(prompts);
            const all = await appDatabase.predefinedPrompts.getAll(profileId);
            expect(all.length).toBe(2);
        });

        it('should update a predefined prompt', async () => {
            const prompt: PredefinedPrompt = { id: 'p4', title: 'Old', prompt: 'Content', profileId } as any;
            await appDatabase.predefinedPrompts.create(prompt);
            await appDatabase.predefinedPrompts.update('p4', { title: 'New' });

            const updated = await appDatabase.predefinedPrompts.getById('p4');
            expect(updated?.title).toBe('New');
        });

        it('should delete a predefined prompt', async () => {
            const prompt: PredefinedPrompt = { id: 'p5', title: 'Del', prompt: 'Content', profileId } as any;
            await appDatabase.predefinedPrompts.create(prompt);
            await appDatabase.predefinedPrompts.delete('p5');

            const deleted = await appDatabase.predefinedPrompts.getById('p5');
            expect(deleted).toBeUndefined();
        });
    });

    describe('QuickReplies DAO', () => {
        beforeEach(async () => {
            await db.delete(quickReplies).where(eq(quickReplies.profileId, profileId));
        });

        it('should create and retrieve a quick reply', async () => {
            const reply: PredefinedPrompt = {
                id: 'q1',
                title: 'Reply 1',
                prompt: 'Content 1',
                // @ts-ignore
                profileId,
            };
            await appDatabase.quickReplies.create(reply);
            const retrieved = await appDatabase.quickReplies.getById('q1');

            expect(retrieved).toBeDefined();
            expect(retrieved?.title).toBe('Reply 1');
        });

        it('should create many quick replies', async () => {
            const replies: PredefinedPrompt[] = [
                { id: 'q2', title: 'R2', prompt: 'C2', profileId },
                { id: 'q3', title: 'R3', prompt: 'C3', profileId }
            ] as any[];
            await appDatabase.quickReplies.createMany(replies);
            const all = await appDatabase.quickReplies.getAll(profileId);
            expect(all.length).toBe(2);
        });

        it('should update a quick reply', async () => {
            const reply: PredefinedPrompt = { id: 'q4', title: 'Old', prompt: 'Content', profileId } as any;
            await appDatabase.quickReplies.create(reply);
            await appDatabase.quickReplies.update('q4', { title: 'New' });

            const updated = await appDatabase.quickReplies.getById('q4');
            expect(updated?.title).toBe('New');
        });

        it('should delete a quick reply', async () => {
            const reply: PredefinedPrompt = { id: 'q5', title: 'Del', prompt: 'Content', profileId } as any;
            await appDatabase.quickReplies.create(reply);
            await appDatabase.quickReplies.delete('q5');

            const deleted = await appDatabase.quickReplies.getById('q5');
            expect(deleted).toBeUndefined();
        });
    });

    describe('GlobalPrompt DAO', () => {
        beforeEach(async () => {
            await db.delete(globalPrompt).where(eq(globalPrompt.profileId, profileId));
        });

        it('should save (create) and get global prompt', async () => {
            await appDatabase.globalPrompt.save('Initial Prompt', profileId);
            const result = await appDatabase.globalPrompt.get(profileId);

            expect(result).toBeDefined();
            expect(result?.prompt).toBe('Initial Prompt');
        });

        it('should save (update) global prompt', async () => {
            await appDatabase.globalPrompt.save('Initial Prompt', profileId);
            await appDatabase.globalPrompt.save('Updated Prompt', profileId);

            const result = await appDatabase.globalPrompt.get(profileId);
            expect(result?.prompt).toBe('Updated Prompt');
        });
    });
});
