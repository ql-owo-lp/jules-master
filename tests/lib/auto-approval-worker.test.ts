
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAutoApprovalCheck } from '@/lib/auto-approval-worker';
import { db } from '@/lib/db';
import * as actions from '@/app/sessions/actions';
import { jobs } from '@/lib/db/schema';

// Mock dependencies
const mockDbChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((callback) => callback([])), // Default resolve to empty array
    // Add Promise interface
    catch: vi.fn(),
    finally: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => mockDbChain),
  },
}));

vi.mock('@/app/sessions/actions', () => ({
  listSessions: vi.fn(),
  approvePlan: vi.fn(),
}));

describe('AutoApprovalWorker', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.JULES_API_KEY = 'test-api-key';
        vi.useFakeTimers();

        // Reset mock implementations
        mockDbChain.from.mockReturnThis();
        mockDbChain.where.mockReturnThis();
        mockDbChain.limit.mockReturnThis();
        mockDbChain.then.mockImplementation((cb) => Promise.resolve([]).then(cb));
    });

    afterEach(() => {
        vi.useRealTimers();
        delete process.env.JULES_API_KEY;
    });

    it('should approve sessions in AWAITING_PLAN_APPROVAL that are not excluded', async () => {
        const mockSessions = [
            { id: 's1', state: 'AWAITING_PLAN_APPROVAL' }, // Should be approved (ungrouped)
            { id: 's2', state: 'COMPLETED' },
            { id: 's3', state: 'AWAITING_PLAN_APPROVAL' }, // Should be approved (in auto-approve job)
            { id: 's4', state: 'AWAITING_PLAN_APPROVAL' }, // Should NOT be approved (in excluded job)
        ];

        const mockJobs = [
            { id: 'j1', sessionIds: ['s3'], autoApproval: true },
            { id: 'j2', sessionIds: ['s4'], autoApproval: false },
        ];

        (actions.listSessions as any).mockResolvedValue(mockSessions);

        // Mock db response for jobs
        // We need to differentiate between `from(jobs)` and `from(settings)`
        mockDbChain.from.mockImplementation((table: any) => {
             // We can check the table object.
             // Ideally we should import schema objects to compare.
             // But for now, let's assume first call is jobs, second is settings (in scheduleNextRun)
             // Or we can return a promise that resolves to mockJobs
             return {
                 ...mockDbChain,
                 then: (cb: any) => Promise.resolve(mockJobs).then(cb),
                 // For subsequent calls (scheduleNextRun calling settings), we want different result
                 // But in this test, we care about the FIRST call which is jobs.
                 // Actually `db.select().from(jobs)` returns a promise-like.
             } as any;
        });

        // Better approach: Mock `db.select` implementation to return different chains based on what calls it?
        // No, `db.select()` returns the builder, then `.from()` is called.
        // We can make `.from` inspect its argument.

        // Let's simplify. `runAutoApprovalCheck` calls `db.select().from(jobs)`.
        // `scheduleNextRun` calls `db.select().from(settings)`.

        // We can just make the mock return mockJobs for the jobs call.
        // The issue is `scheduleNextRun` is called at the end.
        // We can just let `scheduleNextRun` fail or return default.

        // Override mock for this test
        mockDbChain.from.mockImplementation(function(this: any, table: any) {
             // Rudimentary check if it's jobs table (it has autoApproval column) or settings
             // Since we can't easily check table identity without importing schema,
             // let's rely on the fact that `runAutoApprovalCheck` awaits the result.
             return {
                 ...this,
                 then: (cb: any) => {
                     // If it's the jobs query, return mockJobs
                     // If it's settings query, return []
                     // We can't distinguish easily.
                     // But we can check `mockDbChain.from.mock.calls`.
                     return Promise.resolve(mockJobs).then(cb);
                 }
             }
        });

        (actions.approvePlan as any).mockResolvedValue(true);

        await runAutoApprovalCheck();

        expect(actions.listSessions).toHaveBeenCalledWith('test-api-key');
        expect(actions.approvePlan).toHaveBeenCalledWith('s1', 'test-api-key');
        expect(actions.approvePlan).toHaveBeenCalledWith('s3', 'test-api-key');
        expect(actions.approvePlan).not.toHaveBeenCalledWith('s4', 'test-api-key');
    });

    // ... other tests
});
