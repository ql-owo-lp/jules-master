
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { runAutoDeleteStaleBranchCheck, startAutoDeleteStaleBranchWorker, _resetForTest } from '@/lib/auto-delete-stale-branch-worker';
import * as actions from '@/app/sessions/actions';

vi.mock('@/lib/db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('@/app/sessions/actions', () => ({
    fetchSessionsPage: vi.fn(),
}));

vi.mock('@/app/github/actions', () => ({
    getPullRequestStatus: vi.fn(),
}));

vi.mock('@/lib/github-service', () => ({
    deleteBranch: vi.fn(),
}));

describe('AutoDeleteStaleBranchWorker', () => {
    const originalApiKey = process.env.JULES_API_KEY;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(global, 'setTimeout');
        _resetForTest();
        vi.clearAllMocks();
        process.env.JULES_API_KEY = 'test-api-key';
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        if (originalApiKey) {
            process.env.JULES_API_KEY = originalApiKey;
        } else {
            delete process.env.JULES_API_KEY;
        }
    });

    it('should schedule the next run with the custom interval from settings', async () => {
        const customInterval = 1800;
        vi.spyOn(db, 'limit').mockResolvedValue([
            {
                autoDeleteStaleBranches: true,
                autoDeleteStaleBranchesAfterDays: 30,
                autoDeleteStaleBranchesCheckIntervalSeconds: customInterval
            }
        ]);
        vi.mocked(actions.fetchSessionsPage).mockResolvedValue({ sessions: [], nextPageToken: undefined });

        await runAutoDeleteStaleBranchCheck({ schedule: true });

        await new Promise(process.nextTick);

        expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), customInterval * 1000);
    });

    it('should schedule next run with default interval if setting is missing', async () => {
        vi.spyOn(db, 'limit').mockResolvedValue([
            {
                autoDeleteStaleBranches: true,
                autoDeleteStaleBranchesAfterDays: 30,
            }
        ]);
        vi.mocked(actions.fetchSessionsPage).mockResolvedValue({ sessions: [], nextPageToken: undefined });

        await runAutoDeleteStaleBranchCheck({ schedule: true });

        await new Promise(process.nextTick);

        expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3600 * 1000);
    });

    it('startAutoDeleteStaleBranchWorker should trigger a run', async () => {
        let resolveDbSelect;
        const dbSelectPromise = new Promise(resolve => { resolveDbSelect = resolve; });

        vi.spyOn(db, 'select').mockImplementation(() => {
            resolveDbSelect();
            return db; // Return db for chaining
        });

        vi.spyOn(db, 'limit').mockResolvedValue([
            {
                autoDeleteStaleBranches: true,
                autoDeleteStaleBranchesAfterDays: 30,
            }
        ]);
        vi.mocked(actions.fetchSessionsPage).mockResolvedValue({ sessions: [], nextPageToken: undefined });

        await startAutoDeleteStaleBranchWorker();
        await dbSelectPromise;

        expect(db.select).toHaveBeenCalled();
    });
});
