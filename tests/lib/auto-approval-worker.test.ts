
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runAutoApprovalCheck, _resetForTest } from '@/lib/auto-approval-worker';
import * as sessionsActions from '@/app/sessions/actions';
import * as idActions from '@/app/sessions/[id]/actions';
import * as configActions from '@/app/config/actions';
import type { Session } from '@/lib/types';

vi.mock('@/app/sessions/actions', () => ({
    fetchSessionsPage: vi.fn(),
}));

vi.mock('@/app/sessions/[id]/actions', () => ({
    approvePlan: vi.fn(),
}));

vi.mock('@/app/config/actions', () => ({
    getActiveProfile: vi.fn(),
}));

const mockSession: Session = {
    id: '1',
    created_at: new Date().toISOString(),
    state: 'AWAITING_PLAN_APPROVAL',
    error_retries: 0,
    plan_retries: 0,
    prompt_retries: 0,
    has_user_intervened: false,
    github_pr_id: 1,
    github_pr_url: '',
    github_pr_title: '',
    github_pr_body: '',
    github_repo_id: 1,
    github_repo_full_name: '',
    github_pr_is_draft: false,
    github_pr_is_merged: false,
    github_pr_is_closed: false,
    github_pr_created_at: new Date().toISOString(),
    github_pr_updated_at: new Date().toISOString(),
    github_pr_merged_at: null,
    github_pr_closed_at: null,
};

describe('runAutoApprovalCheck', () => {
    beforeEach(() => {
        process.env.JULES_API_KEY = 'test-api-key';
        _resetForTest();
        vi.spyOn(sessionsActions, 'fetchSessionsPage').mockResolvedValue({ sessions: [mockSession], nextPageToken: undefined });
        vi.spyOn(idActions, 'approvePlan').mockResolvedValue(true);
        const getActiveProfileMock = configActions.getActiveProfile as vi.Mock;
        getActiveProfileMock.mockResolvedValue({
            settings: {
                autoApprovalEnabled: true,
                autoApprovalInterval: 60,
            },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should not run without API key', async () => {
        delete process.env.JULES_API_KEY;
        await runAutoApprovalCheck({ schedule: false });
        expect(sessionsActions.fetchSessionsPage).not.toHaveBeenCalled();
    });

    it('should handle no sessions', async () => {
        vi.spyOn(sessionsActions, 'fetchSessionsPage').mockResolvedValue({ sessions: [], nextPageToken: undefined });
        await runAutoApprovalCheck({ schedule: false });
        expect(idActions.approvePlan).not.toHaveBeenCalled();
    });

    it('should approve pending sessions', async () => {
        await runAutoApprovalCheck({ schedule: false });
        expect(idActions.approvePlan).toHaveBeenCalledWith('1', 'test-api-key');
    });

    it('should handle pagination', async () => {
        vi.spyOn(sessionsActions, 'fetchSessionsPage')
            .mockResolvedValueOnce({ sessions: [mockSession], nextPageToken: 'token' })
            .mockResolvedValueOnce({ sessions: [mockSession], nextPageToken: undefined });
        await runAutoApprovalCheck({ schedule: false });
        expect(idActions.approvePlan).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during approval', async () => {
        vi.spyOn(idActions, 'approvePlan').mockRejectedValue(new Error('test error'));
        await runAutoApprovalCheck({ schedule: false });
        expect(idActions.approvePlan).toHaveBeenCalledWith('1', 'test-api-key');
    });

    it('should not approve sessions if autoApprovalEnabled is false', async () => {
        const getActiveProfileMock = configActions.getActiveProfile as vi.Mock;
        getActiveProfileMock.mockResolvedValueOnce({
            settings: {
                autoApprovalEnabled: false,
                autoApprovalInterval: 60,
            },
        });
        await runAutoApprovalCheck({ schedule: false });
        expect(idActions.approvePlan).not.toHaveBeenCalled();
    });
});
