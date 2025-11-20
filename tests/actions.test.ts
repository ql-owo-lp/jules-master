
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getJobs, addJob } from '../src/app/config/actions';
import { Job } from '../src/lib/types';
import { db } from '../src/lib/db';
import { jobs } from '../src/lib/db/schema';

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Config Actions', () => {
    beforeAll(async () => {
        // Clear the jobs table before running the tests
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

    afterAll(async () => {
        // Clear the jobs table after running the tests
        await db.delete(jobs);
    });
});
