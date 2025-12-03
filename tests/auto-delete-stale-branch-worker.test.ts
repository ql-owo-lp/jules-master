
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runAutoDeleteStaleBranchCheck, _resetForTest } from '@/lib/auto-delete-stale-branch-worker';
import * as actions from '@/app/sessions/actions';
import * as githubActions from '@/app/github/actions';
import * as github from '@/lib/github-service';
import { db } from '@/lib/db';

vi.mock('@/app/sessions/actions', () => ({
    fetchSessionsPage: vi.fn(),
}));

vi.mock('@/app/github/actions', () => ({
    getPullRequestStatus: vi.fn(),
}));

vi.mock('@/lib/github-service', () => ({
    deleteBranch: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn(),
    },
}));

describe('runAutoDeleteStaleBranchCheck', () => {
    beforeEach(() => {
        process.env.JULES_API_KEY = 'test-api-key';
        _resetForTest();
        vi.useFakeTimers();
        vi.spyOn(actions, 'fetchSessionsPage').mockResolvedValue({ sessions: [], nextPageToken: undefined });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should schedule the next run with the default interval on error', async () => {
        const settingsMock = db.limit as vi.Mock;
        settingsMock.mockResolvedValueOnce([{ autoDeleteStaleBranches: true, autoDeleteStaleBranchesAfterDays: 1 }]); // 1. Initial run
        settingsMock.mockRejectedValueOnce(new Error('DB error')); // 2. scheduleNextRun (fails)
        settingsMock.mockResolvedValueOnce([{ autoDeleteStaleBranches: true, autoDeleteStaleBranchesAfterDays: 1 }]); // 3. Timed run
        settingsMock.mockResolvedValueOnce([]); // 4. scheduleNextRun from timed run

        await runAutoDeleteStaleBranchCheck();
        expect(actions.fetchSessionsPage).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(3600 * 1000);

        expect(actions.fetchSessionsPage).toHaveBeenCalledTimes(2);
    });

    it('should schedule the next run with a custom interval', async () => {
        const settingsMock = db.limit as vi.Mock;
        const customSettings = {
            autoDeleteStaleBranches: true,
            autoDeleteStaleBranchesAfterDays: 1,
            autoDeleteStaleBranchesInterval: 1800
        };
        settingsMock.mockResolvedValueOnce([customSettings]); // 1. Initial run
        settingsMock.mockResolvedValueOnce([customSettings]); // 2. scheduleNextRun
        settingsMock.mockResolvedValueOnce([customSettings]); // 3. Timed run
        settingsMock.mockResolvedValueOnce([customSettings]); // 4. scheduleNextRun from timed run

        await runAutoDeleteStaleBranchCheck();
        expect(actions.fetchSessionsPage).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1800 * 1000);

        expect(actions.fetchSessionsPage).toHaveBeenCalledTimes(2);
    });

    it('should call deleteBranch with the correct branch name', async () => {
        const settingsMock = db.limit as vi.Mock;
        settingsMock.mockResolvedValueOnce([{ autoDeleteStaleBranches: true, autoDeleteStaleBranchesAfterDays: 1 }]);

        const session = {
            state: 'COMPLETED',
            outputs: [{ pullRequest: { url: 'http://example.com' } }],
            sourceContext: {
                source: 'sources/github/test-owner/test-repo',
                githubRepoContext: { startingBranch: 'test-branch' },
            },
        };

        vi.spyOn(actions, 'fetchSessionsPage').mockResolvedValueOnce({ sessions: [session], nextPageToken: undefined });
        vi.spyOn(githubActions, 'getPullRequestStatus').mockResolvedValue({ state: 'MERGED', merged_at: new Date(0).toISOString() });

        await runAutoDeleteStaleBranchCheck({ schedule: false });

        expect(github.deleteBranch).toHaveBeenCalledWith('test-owner/test-repo', 'test-branch');
    });
});
