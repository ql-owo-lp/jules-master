import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
import { runPrMonitor, _resetForTest } from '@/lib/pr-monitor-worker';
import * as githubService from '@/lib/github-service';
import * as sessionService from '@/lib/session-service';
import * as sessionActions from '@/app/sessions/actions';
import { db } from '@/lib/db';

vi.mock('@/lib/github-service', () => ({
    listOpenPullRequests: vi.fn(),
    getPullRequestCheckStatus: vi.fn(),
    getPullRequestComments: vi.fn(),
    createPullRequestComment: vi.fn(),
    addReactionToIssueComment: vi.fn(),
    getPullRequest: vi.fn(),
    getIssueComment: vi.fn(),
    listPullRequestFiles: vi.fn(),
    updatePullRequest: vi.fn(),
    mergePullRequest: vi.fn(),
    getFailingWorkflowRuns: vi.fn(),
    rerunFailedJobs: vi.fn(),
    getCommit: vi.fn(),
}));

vi.mock('@/lib/session-service', () => ({
    getSettings: vi.fn(),
}));

vi.mock('@/app/sessions/actions', () => ({
    listSources: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
    db: {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
    },
}));

describe('pr-monitor-worker', () => {
    beforeEach(() => {
        process.env.JULES_API_KEY = 'test-api-key';
        _resetForTest();
        vi.spyOn(sessionService, 'getSettings').mockResolvedValue({
            checkFailingActionsEnabled: true,
            checkFailingActionsInterval: 60,
            checkFailingActionsThreshold: 2, // Low threshold for testing
            closePrOnConflictEnabled: false,
        } as any);
        vi.spyOn(sessionActions, 'listSources').mockResolvedValue([{
            githubRepo: { owner: 'test-owner', repo: 'test-repo' }
        }] as any);
        // Default: Lock acquire success (mock db delete/insert don't throw)
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.runAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should scan only bot PRs', async () => {
        const listPRsMock = vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({ status: 'unknown' } as any);
        vi.spyOn(githubService, 'getIssueComment').mockResolvedValue(null); // Default mock
        vi.spyOn(githubService, 'listPullRequestFiles').mockResolvedValue([]); // Default mock
        
        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(listPRsMock).toHaveBeenCalledWith('test-owner/test-repo', 'google-labs-jules');
    });

    it('should comment on failing actions and trigger reruns', async () => {
         vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({
            status: 'failure',
            runs: [{ name: 'test-check', status: 'completed', conclusion: 'failure' }]
        } as any);
        vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([]);
        vi.spyOn(githubService, 'createPullRequestComment').mockResolvedValue(12345);
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({ mergeable: true } as any);
        vi.spyOn(githubService, 'getFailingWorkflowRuns').mockResolvedValue([1001, 1002]);
        vi.spyOn(githubService, 'rerunFailedJobs').mockResolvedValue(true);
        // Mock getIssueComment for monitoring (async call)
        vi.spyOn(githubService, 'getIssueComment').mockResolvedValue({
            id: 12345,
            reactions: { eyes: 1 }
        } as any);

        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            expect.stringContaining('Failing GitHub actions:\n- test-check')
        );

        expect(githubService.createPullRequestComment).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            expect.stringContaining('commit:sha1')
        );

        // Expect reruns to be triggered
        expect(githubService.getFailingWorkflowRuns).toHaveBeenCalledWith('test-owner/test-repo', 'sha1');
        expect(githubService.rerunFailedJobs).toHaveBeenCalledWith('test-owner/test-repo', 1001);
        expect(githubService.rerunFailedJobs).toHaveBeenCalledWith('test-owner/test-repo', 1002);

        expect(githubService.createPullRequestComment).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            expect.not.stringContaining('resolve merge conflicts')
        );
        // Auto-reaction removed
        expect(githubService.addReactionToIssueComment).not.toHaveBeenCalled();

        // Wait for background monitoring
        await vi.advanceTimersByTimeAsync(40000);
        expect(githubService.getIssueComment).toHaveBeenCalledWith('test-owner/test-repo', 12345);
    }, 10000);

    it('should append merge conflict message if not mergeable', async () => {
         vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({
            status: 'failure',
            runs: [{ name: 'test-check', status: 'completed', conclusion: 'failure' }]
        } as any);
        vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([]);
        vi.spyOn(githubService, 'createPullRequestComment').mockResolvedValue(12345);
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({ mergeable: false } as any);
        
        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            expect.not.stringContaining('resolve merge conflicts')
        );
        // Auto-reaction removed
        expect(githubService.addReactionToIssueComment).not.toHaveBeenCalled();

        // Wait for background monitoring
        await vi.advanceTimersByTimeAsync(40000);
    }, 10000);

    it('should skip if already commented on this commit (SHA match)', async () => {
         vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({
            status: 'failure',
            runs: [{ name: 'test-check', status: 'completed', conclusion: 'failure' }]
        } as any);
        
        // Return comment with SHA tag
        vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([
            { body: 'Some comment <!-- jules-bot-check-failing-actions commit:sha1 -->' } as any,
        ]);
        
        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).not.toHaveBeenCalled();
    });

    it('should NOT skip (comment again) if comment is on a DIFFERENT commit', async () => {
        vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
           { number: 1, head: { sha: 'sha2' } } as any
       ]);
       vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({
            status: 'failure',
            runs: [{ name: 'test-check', status: 'completed', conclusion: 'failure' }]
        } as any);
        vi.spyOn(githubService, 'createPullRequestComment').mockResolvedValue(12345);
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({ mergeable: true } as any);
        vi.spyOn(githubService, 'getFailingWorkflowRuns').mockResolvedValue([]);

       // Comment from older commit
       vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([
           { body: 'Some comment <!-- jules-bot-check-failing-actions commit:sha1 -->', created_at: '2023-01-01T00:00:00Z' } as any,
       ]);

        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            expect.stringContaining('commit:sha2') // Expect new SHA
        );
    });

    it('should warn if test files are deleted', async () => {
        vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({
            status: 'failure',
            runs: [{ name: 'test-check', status: 'completed', conclusion: 'failure' }]
        } as any);
        vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([]);
        vi.spyOn(githubService, 'createPullRequestComment').mockResolvedValue(12345);
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({ mergeable: true } as any);
        
        // Mock deleted test file
        vi.spyOn(githubService, 'listPullRequestFiles').mockResolvedValue([
            { filename: 'foo_test.go', status: 'removed' },
            { filename: 'bar.ts', status: 'modified' }
        ]);

        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            expect.stringContaining('Deleting existing tests are not allowed')
        );
    });

    it('should NOT warn if no test files are deleted', async () => {
        vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({
            status: 'failure',
            runs: [{ name: 'test-check', status: 'completed', conclusion: 'failure' }]
        } as any);
        vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([]);
        vi.spyOn(githubService, 'createPullRequestComment').mockResolvedValue(12345);
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({ mergeable: true } as any);
        
        // Mock no deleted test files
        vi.spyOn(githubService, 'listPullRequestFiles').mockResolvedValue([
            { filename: 'foo.go', status: 'modified' }
        ]);

        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            expect.not.stringContaining('Deleting existing tests are not allowed')
        );
    });

    it('should mark PR as ready for review if checks pass and no tests deleted', async () => {
        vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({
            status: 'success',
            runs: [{ name: 'test-check', status: 'completed', conclusion: 'success' }]
        } as any);
        // Mock files - no deletion of tests
        vi.spyOn(githubService, 'listPullRequestFiles').mockResolvedValue([
            { filename: 'foo.go', status: 'modified', deletions: 0 }
        ]);
        // Mock PR - draft=true
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({
            mergeable: true,
            draft: true
        } as any);

        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.updatePullRequest).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            { draft: false }
        );
        expect(githubService.mergePullRequest).not.toHaveBeenCalled();
    });

    it('should auto-merge PR if checks pass and only adding tests', async () => {
        vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({
            status: 'success',
            runs: [{ name: 'test-check', status: 'completed', conclusion: 'success' }]
        } as any);
        // Mock files - only test files, no deletions
        vi.spyOn(githubService, 'listPullRequestFiles').mockResolvedValue([
            { filename: 'foo.test.ts', status: 'added', deletions: 0 }
        ]);
        // Mock PR - mergeable
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({
            mergeable: true,
            draft: false // or true, doesn't matter for merge but logically usually ready
        } as any);

        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.mergePullRequest).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            'rebase'
        );
    });

    it('should NOT auto-merge PR if not only test files', async () => {
        vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({
            status: 'success',
            runs: [{ name: 'test-check', status: 'completed', conclusion: 'success' }]
        } as any);
        // Mock files - mixed content
        vi.spyOn(githubService, 'listPullRequestFiles').mockResolvedValue([
            { filename: 'foo.test.ts', status: 'added', deletions: 0 },
            { filename: 'src/foo.ts', status: 'modified', deletions: 0 }
        ]);

        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({
            mergeable: true,
        } as any);

        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.mergePullRequest).not.toHaveBeenCalled();
    });

    it('should close confused PRs immediately when closePrOnConflictEnabled is true', async () => {
         vi.spyOn(sessionService, 'getSettings').mockResolvedValue({
            checkFailingActionsEnabled: true,
            closePrOnConflictEnabled: true,
        } as any);

        vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({ status: 'unknown' } as any);
        
        // Mock conflicted PR
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({
            mergeable: false,
        } as any);

        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            expect.stringContaining('automatically closed because it has merge conflicts')
        );

        expect(githubService.updatePullRequest).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            { state: 'closed' }
        );
    });

    it('should NOT comment if any check is pending', async () => {
        vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        // Status failure but pending > 0
        vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({
            status: 'failure',
            pending: 1,
            runs: [{ name: 'test-check', status: 'completed', conclusion: 'failure' }]
        } as any);

        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).not.toHaveBeenCalled();
    });

    it('should close stale conflicted PRs when enabled', async () => {
        // Enable setting
        vi.spyOn(sessionService, 'getSettings').mockResolvedValue({
            checkFailingActionsEnabled: true,
            autoCloseStaleConflictedPrs: true,
            staleConflictedPrsDurationDays: 3,
        } as any);

        vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestCheckStatus').mockResolvedValue({ status: 'unknown' } as any);
        
        // Mock conflicted PR with old update time ( > 3 days ago)
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 4); // 4 days ago
        
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({
            mergeable: false,
            updated_at: oldDate.toISOString()
        } as any);

        const execution = runPrMonitor({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            expect.stringContaining('automatically closed')
        );

        expect(githubService.updatePullRequest).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            { state: 'closed' }
        );
    });

    it('should clean up lock after execution', async () => {
        const execution = runPrMonitor({ schedule: false });
        await vi.advanceTimersByTimeAsync(2000); // Advance enough for main loop sleep(1000)
        await execution;
        expect(db.delete).toHaveBeenCalled();
    }, 10000);
});
