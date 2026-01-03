
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
import { runAutoDeleteStaleBranchCheck, _resetForTest } from '@/lib/auto-delete-stale-branch-worker';
import * as githubService from '@/lib/github-service';
import * as sessionActions from '@/app/sessions/actions';
import * as dbLib from '@/lib/db';
import { settings } from '@/lib/db/schema';

vi.mock('@/lib/github-service', () => ({
    deleteBranch: vi.fn(),
    listBranches: vi.fn(),
    listOpenPullRequests: vi.fn(),
    getCommit: vi.fn(),
}));

vi.mock('@/app/sessions/actions', () => ({
  __esModule: true,
  listSources: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
    },
}));

describe('auto-delete-stale-branch-worker', () => {
    beforeEach(() => {
        process.env.JULES_API_KEY = 'test-api-key';
        _resetForTest();
        vi.useFakeTimers();

        // Default settings mock
        const mockSettings = [{
            autoDeleteStaleBranches: true,
            autoDeleteStaleBranchesAfterDays: 5,
        }];
        const limitMock = vi.fn().mockResolvedValue(mockSettings);
        (dbLib.db.limit as Mock).mockImplementation(limitMock);
        
        // Mock listSources returning one repo
        (sessionActions.listSources as Mock).mockResolvedValue([{
            githubRepo: { owner: 'test-owner', repo: 'test-repo' }
        }]);
    });

    afterEach(() => {
        vi.runAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should delete stale orphan branch created by bot', async () => {
        const now = Date.now();
        const oldDate = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(); // 6 days ago (threshold 5)

        (githubService.listBranches as Mock).mockResolvedValue([
            { name: 'bot-branch', protected: false, commit: { sha: 'sha1' } },
            { name: 'main', protected: true, commit: { sha: 'sha2' } },
        ]);

        (githubService.listOpenPullRequests as Mock).mockResolvedValue([]); // No open PRs

        (githubService.getCommit as Mock).mockResolvedValue({
            commit: {
                author: { name: 'google-labs-jules' },
                committer: { name: 'google-labs-jules', date: oldDate },
            }
        });

        (githubService.deleteBranch as Mock).mockResolvedValue(true);

        const execution = runAutoDeleteStaleBranchCheck({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.deleteBranch).toHaveBeenCalledWith('test-owner/test-repo', 'bot-branch');
    });

    it('should NOT delete fresh orphan branch', async () => {
        const now = Date.now();
        const freshDate = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago

        (githubService.listBranches as Mock).mockResolvedValue([
            { name: 'bot-branch', protected: false, commit: { sha: 'sha1' } },
        ]);

        (githubService.listOpenPullRequests as Mock).mockResolvedValue([]);

        (githubService.getCommit as Mock).mockResolvedValue({
            commit: {
                author: { name: 'google-labs-jules' },
                committer: { name: 'google-labs-jules', date: freshDate },
            }
        });

        const execution = runAutoDeleteStaleBranchCheck({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.deleteBranch).not.toHaveBeenCalled();
    });

    it('should NOT delete branch with open PR', async () => {
        (githubService.listBranches as Mock).mockResolvedValue([
            { name: 'bot-branch', protected: false, commit: { sha: 'sha1' } },
        ]);

        // Branch has an open PR
        (githubService.listOpenPullRequests as Mock).mockResolvedValue([
            { head: { ref: 'bot-branch' } }
        ]);

        const execution = runAutoDeleteStaleBranchCheck({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.getCommit).not.toHaveBeenCalled(); // Optimization check
        expect(githubService.deleteBranch).not.toHaveBeenCalled();
    });

    it('should NOT delete branch NOT created by bot', async () => {
        const now = Date.now();
        const oldDate = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString();

        (githubService.listBranches as Mock).mockResolvedValue([
            { name: 'user-branch', protected: false, commit: { sha: 'sha1' } },
        ]);

        (githubService.listOpenPullRequests as Mock).mockResolvedValue([]);

        (githubService.getCommit as Mock).mockResolvedValue({
            commit: {
                author: { name: 'some-user' },
                committer: { name: 'some-user', date: oldDate },
            }
        });

        const execution = runAutoDeleteStaleBranchCheck({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.deleteBranch).not.toHaveBeenCalled();
    });

    it('should skip if feature is disabled', async () => {
        const mockSettings = [{
            autoDeleteStaleBranches: false,
        }];
        const limitMock = vi.fn().mockResolvedValue(mockSettings);
        (dbLib.db.limit as Mock).mockImplementation(limitMock);

        const execution = runAutoDeleteStaleBranchCheck({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(sessionActions.listSources).not.toHaveBeenCalled();
    });
});
