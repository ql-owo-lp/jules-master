
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getJobs, addJob, savePredefinedPrompts, getPredefinedPrompts } from '../src/app/config/actions';
import { Job, PredefinedPrompt } from '../src/lib/types';
import { db } from '../src/lib/db';
import { jobs, predefinedPrompts } from '../src/lib/db/schema';

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Config Actions', () => {
    beforeAll(async () => {
        // Clear the jobs table before running the tests
        await db.delete(jobs);
        await db.delete(predefinedPrompts);
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

    it('should reproduce data loss when saving predefined prompts fails', async () => {
        const initialPrompts: PredefinedPrompt[] = [
            { id: '1', title: 'Prompt 1', prompt: 'Content 1' },
            { id: '2', title: 'Prompt 2', prompt: 'Content 2' }
        ];

        // 1. Save initial prompts
        await savePredefinedPrompts(initialPrompts);
        let currentPrompts = await getPredefinedPrompts();
        expect(currentPrompts.length).toBe(2);

        // 2. Attempt to save new prompts with a duplicate ID which should fail
        const faultyPrompts: PredefinedPrompt[] = [
             { id: '3', title: 'Prompt 3', prompt: 'Content 3' },
             { id: '3', title: 'Prompt 3 (Duplicate)', prompt: 'Content 3' } // Duplicate ID
        ];

        try {
            await savePredefinedPrompts(faultyPrompts);
        } catch (error) {
            // Expected error
        }

        // 3. Check if original prompts are still there
        currentPrompts = await getPredefinedPrompts();
        // If the bug exists, currentPrompts will be empty because the delete happened before the failed insert
        expect(currentPrompts.length).toBe(2); // This assertion should fail if the bug is present
    });

    afterAll(async () => {
        // Clear the jobs table after running the tests
        await db.delete(jobs);
        await db.delete(predefinedPrompts);
    });
});
