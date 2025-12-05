
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { appDatabase } from '../src/lib/db';
import { Job, PredefinedPrompt } from '../src/lib/types';
import { db } from '../src/lib/db';
import { jobs, predefinedPrompts, quickReplies, globalPrompt, profiles, settings, sessions, cronJobs, historyPrompts, repoPrompts } from '../src/lib/db/schema';
import { profileService } from '../src/lib/db/profile-service';

describe('Database Layer', () => {
    let testProfileId: string;

    const clearDb = async () => {
        // Delete in order of dependency (child first)
        await db.delete(settings);
        await db.delete(jobs);
        await db.delete(sessions);
        await db.delete(cronJobs);
        await db.delete(predefinedPrompts);
        await db.delete(quickReplies);
        await db.delete(globalPrompt);
        await db.delete(historyPrompts);
        await db.delete(repoPrompts);

        await db.delete(profiles);
    }

    beforeAll(async () => {
        // Clear tables before running the tests
        await clearDb();

        // Create a test profile
        const profile = await profileService.createProfile("Test Profile");
        testProfileId = profile.id;
    });

    afterAll(async () => {
        // Clear tables after running the tests
        await clearDb();
    });

    describe('Jobs DAO', () => {
        beforeEach(async () => {
            await db.delete(jobs);
        });

        it('should create and retrieve a job', async () => {
            const newJob: Job = {
                id: '1',
                name: 'Test Job',
                sessionIds: ['session1'],
                createdAt: new Date().toISOString(),
                repo: 'test/repo',
                branch: 'main',
                profileId: testProfileId,
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
                    profileId: testProfileId,
                },
                {
                    id: '3',
                    name: 'Job 3',
                    sessionIds: [],
                    createdAt: new Date().toISOString(),
                    repo: 'test/repo',
                    branch: 'main',
                    profileId: testProfileId,
                }
            ];

            await appDatabase.jobs.createMany(jobList);
            const allJobs = await appDatabase.jobs.getAll();
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
                profileId: testProfileId,
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
                profileId: testProfileId,
            };
            await appDatabase.jobs.create(job);
            await appDatabase.jobs.delete('5');

            const deleted = await appDatabase.jobs.getById('5');
            expect(deleted).toBeUndefined();
        });
    });

    describe('PredefinedPrompts DAO', () => {
        beforeEach(async () => {
            await db.delete(predefinedPrompts);
        });

        it('should create and retrieve a predefined prompt', async () => {
            const prompt: PredefinedPrompt = {
                id: 'p1',
                title: 'Prompt 1',
                prompt: 'Content 1',
                profileId: testProfileId,
            };
            await appDatabase.predefinedPrompts.create(prompt);
            const retrieved = await appDatabase.predefinedPrompts.getById('p1');

            expect(retrieved).toBeDefined();
            expect(retrieved?.title).toBe('Prompt 1');
        });

        it('should create many predefined prompts', async () => {
            const prompts: PredefinedPrompt[] = [
                { id: 'p2', title: 'P2', prompt: 'C2', profileId: testProfileId },
                { id: 'p3', title: 'P3', prompt: 'C3', profileId: testProfileId }
            ];
            await appDatabase.predefinedPrompts.createMany(prompts);
            const all = await appDatabase.predefinedPrompts.getAll();
            expect(all.length).toBe(2);
        });

        it('should update a predefined prompt', async () => {
            const prompt: PredefinedPrompt = { id: 'p4', title: 'Old', prompt: 'Content', profileId: testProfileId };
            await appDatabase.predefinedPrompts.create(prompt);
            await appDatabase.predefinedPrompts.update('p4', { title: 'New' });

            const updated = await appDatabase.predefinedPrompts.getById('p4');
            expect(updated?.title).toBe('New');
        });

        it('should delete a predefined prompt', async () => {
            const prompt: PredefinedPrompt = { id: 'p5', title: 'Del', prompt: 'Content', profileId: testProfileId };
            await appDatabase.predefinedPrompts.create(prompt);
            await appDatabase.predefinedPrompts.delete('p5');

            const deleted = await appDatabase.predefinedPrompts.getById('p5');
            expect(deleted).toBeUndefined();
        });
    });

    describe('QuickReplies DAO', () => {
        beforeEach(async () => {
            await db.delete(quickReplies);
        });

        it('should create and retrieve a quick reply', async () => {
            const reply: PredefinedPrompt = {
                id: 'q1',
                title: 'Reply 1',
                prompt: 'Content 1',
                profileId: testProfileId,
            };
            await appDatabase.quickReplies.create(reply);
            const retrieved = await appDatabase.quickReplies.getById('q1');

            expect(retrieved).toBeDefined();
            expect(retrieved?.title).toBe('Reply 1');
        });

        it('should create many quick replies', async () => {
            const replies: PredefinedPrompt[] = [
                { id: 'q2', title: 'R2', prompt: 'C2', profileId: testProfileId },
                { id: 'q3', title: 'R3', prompt: 'C3', profileId: testProfileId }
            ];
            await appDatabase.quickReplies.createMany(replies);
            const all = await appDatabase.quickReplies.getAll();
            expect(all.length).toBe(2);
        });

        it('should update a quick reply', async () => {
            const reply: PredefinedPrompt = { id: 'q4', title: 'Old', prompt: 'Content', profileId: testProfileId };
            await appDatabase.quickReplies.create(reply);
            await appDatabase.quickReplies.update('q4', { title: 'New' });

            const updated = await appDatabase.quickReplies.getById('q4');
            expect(updated?.title).toBe('New');
        });

        it('should delete a quick reply', async () => {
            const reply: PredefinedPrompt = { id: 'q5', title: 'Del', prompt: 'Content', profileId: testProfileId };
            await appDatabase.quickReplies.create(reply);
            await appDatabase.quickReplies.delete('q5');

            const deleted = await appDatabase.quickReplies.getById('q5');
            expect(deleted).toBeUndefined();
        });
    });

    describe('GlobalPrompt DAO', () => {
        beforeEach(async () => {
            await db.delete(globalPrompt);
        });

        it('should save (create) and get global prompt', async () => {
            await appDatabase.globalPrompt.save('Initial Prompt', testProfileId);
            const result = await appDatabase.globalPrompt.get(testProfileId);

            expect(result).toBeDefined();
            expect(result?.prompt).toBe('Initial Prompt');
        });

        it('should save (update) global prompt', async () => {
            await appDatabase.globalPrompt.save('Initial Prompt', testProfileId);
            await appDatabase.globalPrompt.save('Updated Prompt', testProfileId);

            const result = await appDatabase.globalPrompt.get(testProfileId);
            expect(result?.prompt).toBe('Updated Prompt');
        });
    });
});
