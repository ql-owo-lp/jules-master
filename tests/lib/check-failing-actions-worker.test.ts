import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
import { runCheckFailingActions, _resetForTest } from '@/lib/check-failing-actions-worker';
import * as githubService from '@/lib/github-service';
import * as sessionService from '@/lib/session-service';
import * as sessionActions from '@/app/sessions/actions';
import { db } from '@/lib/db';

vi.mock('@/lib/github-service', () => ({
    listOpenPullRequests: vi.fn(),
    getPullRequestChecks: vi.fn(),
    getPullRequestComments: vi.fn(),
    createPullRequestComment: vi.fn(),
    addReactionToIssueComment: vi.fn(),
    getPullRequest: vi.fn(),
    getIssueComment: vi.fn(),
    listPullRequestFiles: vi.fn(),
    getFailingWorkflowRuns: vi.fn(),
    rerunFailedJobs: vi.fn(),
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

describe('check-failing-actions-worker', () => {
    beforeEach(() => {
        process.env.JULES_API_KEY = 'test-api-key';
        _resetForTest();
        vi.spyOn(sessionService, 'getSettings').mockResolvedValue({
            checkFailingActionsEnabled: true,
            checkFailingActionsInterval: 60,
            checkFailingActionsThreshold: 2, // Low threshold for testing
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
        vi.spyOn(githubService, 'getPullRequestChecks').mockResolvedValue([]);
        vi.spyOn(githubService, 'getIssueComment').mockResolvedValue(null); // Default mock
        vi.spyOn(githubService, 'listPullRequestFiles').mockResolvedValue([]); // Default mock
        
        const execution = runCheckFailingActions({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(listPRsMock).toHaveBeenCalledWith('test-owner/test-repo', 'google-labs-jules');
    });

    it('should comment on failing actions and trigger reruns', async () => {
         vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestChecks').mockResolvedValue([{ name: 'test-check' }]);
        vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([]);
        vi.spyOn(githubService, 'createPullRequestComment').mockResolvedValue(12345);
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({ mergeable: true } as any);
        vi.spyOn(githubService, 'getFailingWorkflowRuns').mockResolvedValue([1001, 1002]);
        vi.spyOn(githubService, 'rerunFailedJobs').mockResolvedValue(true);
        
        const execution = runCheckFailingActions({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            expect.stringContaining('Failing GitHub actions: test-check')
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
    }, 10000);

    it('should append merge conflict message if not mergeable', async () => {
         vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestChecks').mockResolvedValue([{ name: 'test-check' }]);
        vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([]);
        vi.spyOn(githubService, 'createPullRequestComment').mockResolvedValue(12345);
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({ mergeable: false } as any);
        
        const execution = runCheckFailingActions({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            expect.stringContaining('resolve merge conflicts')
        );
        // Auto-reaction removed
        expect(githubService.addReactionToIssueComment).not.toHaveBeenCalled();

        // Wait for background monitoring
        await vi.advanceTimersByTimeAsync(40000);
    }, 10000);

    it('should skip if threshold reached', async () => {
         vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestChecks').mockResolvedValue([{ name: 'test-check' }]);
        // Threshold is 2. Return 2 comments by "us" with the TAG.
        vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([
            { body: 'Some comment <!-- jules-bot-check-failing-actions -->' } as any,
            { body: 'Another comment <!-- jules-bot-check-failing-actions -->' } as any,
        ]);
        
        const execution = runCheckFailingActions({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).not.toHaveBeenCalled();
    });

    it('should skip if last comment is by us (old content match)', async () => {
        vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
           { number: 1, head: { sha: 'sha1' } } as any
       ]);
       vi.spyOn(githubService, 'getPullRequestChecks').mockResolvedValue([{ name: 'test-check' }]);
       // Only 1 comment, but it is by us (with TAG) and is the last one.
       vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([
           { body: '@jules the GitHub actions are failing' } as any,
       ]);

       const execution = runCheckFailingActions({ schedule: false });
       await vi.runAllTimersAsync();
       await execution;

       expect(githubService.createPullRequestComment).not.toHaveBeenCalled();
   });

    it('should skip if last comment is by us', async () => {
         vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestChecks').mockResolvedValue([{ name: 'test-check' }]);
        // Only 1 comment, but it is by us (with TAG) and is the last one.
        vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([
            { body: 'Some comment <!-- jules-bot-check-failing-actions -->' } as any,
        ]);
        
        const execution = runCheckFailingActions({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).not.toHaveBeenCalled();
    });

    it('should post comment and monitor reaction (instead of auto-reacting)', async () => {
         vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestChecks').mockResolvedValue([{ name: 'test-check' }]);
        vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([]);
        // Mock getIssueComment for monitoring
        vi.spyOn(githubService, 'getIssueComment').mockResolvedValue({
            id: 12345,
            reactions: { eyes: 1 }
        } as any);

        vi.spyOn(githubService, 'createPullRequestComment').mockResolvedValue(12345);
        vi.spyOn(githubService, 'createPullRequestComment').mockResolvedValue(12345);
        
        // Timer setup moved to beforeEach

        const execution = runCheckFailingActions({ schedule: false });
        await vi.advanceTimersByTimeAsync(2000); // Advance enough for main loop sleep(1000)
        await execution;

        expect(githubService.createPullRequestComment).toHaveBeenCalled();
        // Auto-reaction should be REMOVED
        expect(githubService.addReactionToIssueComment).not.toHaveBeenCalled();

        // Advance time to trigger monitoring (30s)
        await vi.advanceTimersByTimeAsync(35000); 

        // Check if monitoring fetched the comment
        expect(githubService.getIssueComment).toHaveBeenCalledWith('test-owner/test-repo', 12345);
        
        // Teardown handled by afterEach
    });
    it('should warn if test files are deleted', async () => {
        vi.spyOn(githubService, 'listOpenPullRequests').mockResolvedValue([
            { number: 1, head: { sha: 'sha1' } } as any
        ]);
        vi.spyOn(githubService, 'getPullRequestChecks').mockResolvedValue([{ name: 'test-check' }]);
        vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([]);
        vi.spyOn(githubService, 'createPullRequestComment').mockResolvedValue(12345);
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({ mergeable: true } as any);
        
        // Mock deleted test file
        vi.spyOn(githubService, 'listPullRequestFiles').mockResolvedValue([
            { filename: 'foo_test.go', status: 'removed' },
            { filename: 'bar.ts', status: 'modified' }
        ]);

        const execution = runCheckFailingActions({ schedule: false });
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
        vi.spyOn(githubService, 'getPullRequestChecks').mockResolvedValue([{ name: 'test-check' }]);
        vi.spyOn(githubService, 'getPullRequestComments').mockResolvedValue([]);
        vi.spyOn(githubService, 'createPullRequestComment').mockResolvedValue(12345);
        vi.spyOn(githubService, 'getPullRequest').mockResolvedValue({ mergeable: true } as any);
        
        // Mock no deleted test files
        vi.spyOn(githubService, 'listPullRequestFiles').mockResolvedValue([
            { filename: 'foo.go', status: 'modified' }
        ]);

        const execution = runCheckFailingActions({ schedule: false });
        await vi.runAllTimersAsync();
        await execution;

        expect(githubService.createPullRequestComment).toHaveBeenCalledWith(
            'test-owner/test-repo',
            1,
            expect.not.stringContaining('Deleting existing tests are not allowed')
        );
    });
    

    it('should clean up lock after execution', async () => {
        const execution = runCheckFailingActions({ schedule: false });
        await vi.advanceTimersByTimeAsync(2000); // Advance enough for main loop sleep(1000)
        await execution;
        expect(db.delete).toHaveBeenCalled();
    }, 10000);
});
