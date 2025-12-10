
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from 'vitest';
import { runAutoApprovalCheck, _resetForTest } from '@/lib/auto-approval-worker';
import * as sessionsActions from '@/app/sessions/actions';
import * as idActions from '@/app/sessions/[id]/actions';
import { db } from '@/lib/db';
import type { Session } from '@/lib/types';

vi.mock('@/app/sessions/actions', () => ({
    fetchSessionsPage: vi.fn(),
}));

vi.mock('@/app/sessions/[id]/actions', () => ({
    approvePlan: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn(),
    },
}));

const mockSession: Session = {
    id: '1',
    name: 'sessions/1',
    title: 'Test Session',
    prompt: 'Test Prompt',
    createTime: new Date().toISOString(),
    state: 'AWAITING_PLAN_APPROVAL',
    profileId: 'default'
} as any;

describe('runAutoApprovalCheck', () => {
    beforeEach(() => {
        process.env.JULES_API_KEY = 'test-api-key';
        _resetForTest();
        vi.spyOn(sessionsActions, 'fetchSessionsPage').mockResolvedValue({ sessions: [mockSession], nextPageToken: undefined });
        vi.spyOn(idActions, 'approvePlan').mockResolvedValue({ id: '1' } as any);
        const settingsMock = (db as any).limit as Mock;
        settingsMock.mockResolvedValue([{ autoApprovalEnabled: true, autoApprovalInterval: 60 }]);
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
        const settingsMock = (db as any).limit as Mock;
        settingsMock.mockResolvedValueOnce([{ autoApprovalEnabled: false, autoApprovalInterval: 60 }]);
        await runAutoApprovalCheck({ schedule: false });
        expect(idActions.approvePlan).not.toHaveBeenCalled();
    });
});
