
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appDatabase } from '../src/lib/db';
import { Job } from '../src/lib/types';
import { db } from '../src/lib/db';
import { jobs } from '../src/lib/db/schema';

describe('Database Layer', () => {
    beforeAll(async () => {
        // Clear the jobs table before running the tests
        await db.delete(jobs);
    });

    it('should add a and retrieve a job', async () => {
        const newJob: Job = {
            id: '1',
            name: 'Test Job',
            sessionIds: ['session1'],
            createdAt: new Date().toISOString(),
            repo: 'test/repo',
            branch: 'main',
        };

        await appDatabase.jobs.create(newJob);
        const retrievedJob = await appDatabase.jobs.getById('1');

        expect(retrievedJob).toBeDefined();
        expect(retrievedJob?.name).toBe('Test Job');
    });

    afterAll(async () => {
        // Clear the jobs table after running the tests
        await db.delete(jobs);
    });
});
