
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAutoApprovalCheck } from '@/lib/auto-approval-worker';
import { db } from '@/lib/db';
import * as actions from '@/app/sessions/[id]/actions';
import { jobs } from '@/lib/db/schema';

// Mock dependencies
const mockDbChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((callback) => callback([])), // Default resolve to empty array
    catch: vi.fn(),
    finally: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => mockDbChain),
  },
}));

// Mock actions from [id]/actions, NOT the main actions file
vi.mock('@/app/sessions/[id]/actions', () => ({
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

        // Mock global fetch
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
        delete process.env.JULES_API_KEY;
        vi.restoreAllMocks();
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

        // Mock fetch response for listSessions
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ sessions: mockSessions }),
        });

        // Mock db response for jobs
        mockDbChain.from.mockImplementation(function(this: any, table: any) {
             return {
                 ...this,
                 then: (cb: any) => Promise.resolve(mockJobs).then(cb),
             }
        });

        (actions.approvePlan as any).mockResolvedValue(true);

        await runAutoApprovalCheck();

        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/v1alpha/sessions'), expect.objectContaining({
            headers: { 'X-Goog-Api-Key': 'test-api-key' }
        }));

        expect(actions.approvePlan).toHaveBeenCalledWith('s1', 'test-api-key');
        expect(actions.approvePlan).toHaveBeenCalledWith('s3', 'test-api-key');
        expect(actions.approvePlan).not.toHaveBeenCalledWith('s4', 'test-api-key');
    });

    it('should handle sessions with no pending items', async () => {
        const mockSessions = [
            { id: 's1', state: 'COMPLETED' },
        ];

        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({ sessions: mockSessions }),
        });

        await runAutoApprovalCheck();

        expect(global.fetch).toHaveBeenCalled();
        // We cannot assert db.select.not.toHaveBeenCalled because scheduleNextRun calls it for settings
        expect(actions.approvePlan).not.toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
        (global.fetch as any).mockRejectedValue(new Error('API Error'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await runAutoApprovalCheck();

        expect(consoleSpy).toHaveBeenCalledWith("AutoApprovalWorker: Error fetching sessions:", expect.any(Error));
    });
});
