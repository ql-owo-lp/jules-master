
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runBackgroundJobCheck } from '../../src/lib/background-job-worker';
import { db } from '../../src/lib/db';
import { jobs, sessions } from '../../src/lib/db/schema';
import * as sessionActions from '../../src/app/sessions/new/actions';
import * as sessionService from '../../src/lib/session-service';
import * as actions from '../../src/app/sessions/actions';

// Mock dependencies
vi.mock('../../src/app/sessions/new/actions', () => ({
  createSession: vi.fn(),
}));

vi.mock('../../src/lib/session-service', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        // @ts-ignore
        ...actual,
        upsertSession: vi.fn(),
    };
});

vi.mock('../../src/app/sessions/actions', () => ({
    listActivities: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn(),
    listSources: vi.fn().mockResolvedValue([{
        name: 'test-source',
        githubRepo: {
            owner: 'test',
            repo: 'repo',
            branches: [{ displayName: 'main' }]
        }
    }]),
}));

describe('Background Job Worker Integration', () => {
    beforeEach(async () => {
        // Clear jobs table
        await db.delete(jobs);
        await db.delete(sessions);
        vi.clearAllMocks();
        process.env.JULES_API_KEY = 'test-api-key';
    });

    afterEach(() => {
        delete process.env.JULES_API_KEY;
    });

    it('should handle DB errors gracefully and retry without crashing', async () => {
        const jobId = 'job-integration-test';
        const sessionCount = 2; // Keep it small for test speed

        await db.insert(jobs).values({
            id: jobId,
            name: 'Integration Test Job',
            sessionIds: [],
            createdAt: new Date().toISOString(),
            repo: 'test/repo',
            branch: 'main',
            background: true,
            prompt: 'Test prompt',
            sessionCount: sessionCount,
            status: 'PENDING',
            automationMode: 'AUTO_CREATE_PR',
            requirePlanApproval: false
        });

        // Mock createSession to always succeed
        (sessionActions.createSession as any).mockResolvedValue({
            id: 'session-id-' + Math.random(),
            state: 'CREATED'
        });

        // Mock upsertSession to FAIL initially then succeed
        let callCount = 0;
        (sessionService.upsertSession as any).mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                throw new Error('Transient DB Error');
            }
            return Promise.resolve();
        });

        // Run the worker check
        await runBackgroundJobCheck({ schedule: false });

        // Verify the job
        const fetchedJob = await db.select().from(jobs).execute().then(rows => rows.find(r => r.id === jobId));

        expect(fetchedJob).toBeDefined();

        // Since we have retry logic, it should eventually succeed for the first session too
        // Session 1: Fails once, retries, succeeds.
        // Session 2: Succeeds.
        // Total success count should be 2.
        expect(fetchedJob?.status).toBe('COMPLETED');
        expect(fetchedJob?.sessionIds?.length).toBe(sessionCount);

        // Ensure createSession was called for each session
        expect(sessionActions.createSession).toHaveBeenCalledTimes(sessionCount);
    }, 10000);

    it('should result in partial success if DB permanently fails', async () => {
         const jobId = 'job-perm-fail';
         const sessionCount = 2;

         await db.insert(jobs).values({
             id: jobId,
             name: 'Perm Fail Job',
             sessionIds: [],
             createdAt: new Date().toISOString(),
             repo: 'test/repo',
             branch: 'main',
             background: true,
             prompt: 'Test prompt',
             sessionCount: sessionCount,
             status: 'PENDING',
             automationMode: 'AUTO_CREATE_PR',
             requirePlanApproval: false
         });

         (sessionActions.createSession as any).mockResolvedValue({
             id: 'session-id-perm',
             state: 'CREATED'
         });

         // Mock upsertSession to ALWAYS fail
         (sessionService.upsertSession as any).mockRejectedValue(new Error('Permanent DB Error'));

         await runBackgroundJobCheck({ schedule: false });

         const fetchedJob = await db.select().from(jobs).execute().then(rows => rows.find(r => r.id === jobId));

         // Should be PARTIAL_SUCCESS (actually FAILED in our logic if successCount is 0?)
         // Wait, if 0 sessions succeeded, it is FAILED.
         // In this case, 0 sessions succeeded (because DB write failed).
         // So status should be FAILED.
         expect(fetchedJob?.status).toBe('FAILED');
         expect(fetchedJob?.sessionIds?.length).toBe(0);
    });
});
