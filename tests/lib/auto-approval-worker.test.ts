
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as worker from '@/lib/auto-approval-worker';
import * as sessionActions from '@/app/sessions/actions';
import * as planActions from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';
import { dbThen } from '@/lib/db';

vi.mock('@/lib/db');
vi.mock('@/app/sessions/actions');
vi.mock('@/app/sessions/[id]/actions');

describe('AutoApprovalWorker', () => {
    beforeEach(() => {
        vi.spyOn(worker, 'scheduleNextRun').mockImplementation(() => {});
        process.env.JULES_API_KEY = 'test-api-key';

        dbThen.mockImplementation((callback) => {
            callback([{ autoApprovalInterval: 60 }]);
            return { catch: vi.fn() };
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        delete process.env.JULES_API_KEY;
    });

    it('should not run if JULES_API_KEY is not set', async () => {
        delete process.env.JULES_API_KEY;
        await worker.runAutoApprovalCheck();
        expect(sessionActions.fetchSessionsPage).not.toHaveBeenCalled();
    });

    it('should fetch sessions and approve pending ones', async () => {
        const sessions: Session[] = [
            { id: '1', state: 'AWAITING_PLAN_APPROVAL' },
            { id: '2', state: 'RUNNING' },
            { id: '3', state: 'AWAITING_PLAN_APPROVAL' },
        ] as Session[];

        vi.mocked(sessionActions.fetchSessionsPage).mockResolvedValue({ sessions, nextPageToken: undefined });
        vi.mocked(planActions.approvePlan).mockResolvedValue(true);

        await worker.runAutoApprovalCheck();

        expect(sessionActions.fetchSessionsPage).toHaveBeenCalledWith('test-api-key', undefined, 50);
        expect(planActions.approvePlan).toHaveBeenCalledTimes(2);
        expect(planActions.approvePlan).toHaveBeenCalledWith('1', 'test-api-key');
        expect(planActions.approvePlan).toHaveBeenCalledWith('3', 'test-api-key');
    });

    it('should handle pagination', async () => {
        const sessions1: Session[] = [{ id: '1', state: 'AWAITING_PLAN_APPROVAL' }] as Session[];
        const sessions2: Session[] = [{ id: '2', state: 'AWAITING_PLAN_APPROVAL' }] as Session[];

        vi.mocked(sessionActions.fetchSessionsPage)
            .mockResolvedValueOnce({ sessions: sessions1, nextPageToken: 'token' })
            .mockResolvedValueOnce({ sessions: sessions2, nextPageToken: undefined });
        vi.mocked(planActions.approvePlan).mockResolvedValue(true);

        await worker.runAutoApprovalCheck();

        expect(sessionActions.fetchSessionsPage).toHaveBeenCalledTimes(2);
        expect(planActions.approvePlan).toHaveBeenCalledTimes(2);
    });
});
