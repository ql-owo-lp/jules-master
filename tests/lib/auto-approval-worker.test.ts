
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAutoApprovalCheck, _resetForTest } from '@/lib/auto-approval-worker';
import * as db from '@/lib/db';
import * as actions from '@/app/sessions/actions';
import * as idActions from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ autoApprovalInterval: 60 }]),
  },
}));

vi.mock('@/app/sessions/actions', () => ({
  fetchSessionsPage: vi.fn(),
}));

vi.mock('@/app/sessions/[id]/actions', () => ({
  approvePlan: vi.fn(),
}));

describe('AutoApprovalWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    process.env.JULES_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    _resetForTest();
    vi.useRealTimers();
    vi.clearAllTimers();
    delete process.env.JULES_API_KEY;
  });

  it('should not run if JULES_API_KEY is not set', async () => {
    delete process.env.JULES_API_KEY;
    await runAutoApprovalCheck({ schedule: false });
    expect(actions.fetchSessionsPage).not.toHaveBeenCalled();
  });

  it('should handle no sessions being returned', async () => {
    vi.mocked(actions.fetchSessionsPage).mockResolvedValue({ sessions: [], nextPageToken: undefined });
    await runAutoApprovalCheck({ schedule: false });
    expect(actions.fetchSessionsPage).toHaveBeenCalledTimes(1);
    expect(idActions.approvePlan).not.toHaveBeenCalled();
  });

  it('should approve sessions that are awaiting plan approval', async () => {
    const sessions: Session[] = [
      { id: '1', state: 'AWAITING_PLAN_APPROVAL' },
      { id: '2', state: 'COMPLETED' },
      { id: '3', state: 'AWAITING_PLAN_APPROVAL' },
    ];
    vi.mocked(actions.fetchSessionsPage).mockResolvedValue({ sessions, nextPageToken: undefined });
    vi.mocked(idActions.approvePlan).mockResolvedValue(true);

    await runAutoApprovalCheck({ schedule: false });

    expect(actions.fetchSessionsPage).toHaveBeenCalledTimes(1);
    expect(idActions.approvePlan).toHaveBeenCalledTimes(2);
    expect(idActions.approvePlan).toHaveBeenCalledWith('1', 'test-api-key');
    expect(idActions.approvePlan).toHaveBeenCalledWith('3', 'test-api-key');
  });

  it('should handle pagination', async () => {
    const sessions1: Session[] = [{ id: '1', state: 'AWAITING_PLAN_APPROVAL' }];
    const sessions2: Session[] = [{ id: '2', state: 'AWAITING_PLAN_APPROVAL' }];
    vi.mocked(actions.fetchSessionsPage)
      .mockResolvedValueOnce({ sessions: sessions1, nextPageToken: 'token' })
      .mockResolvedValueOnce({ sessions: sessions2, nextPageToken: undefined });
    vi.mocked(idActions.approvePlan).mockResolvedValue(true);

    await runAutoApprovalCheck({ schedule: false });

    expect(actions.fetchSessionsPage).toHaveBeenCalledTimes(2);
    expect(idActions.approvePlan).toHaveBeenCalledTimes(2);
    expect(idActions.approvePlan).toHaveBeenCalledWith('1', 'test-api-key');
    expect(idActions.approvePlan).toHaveBeenCalledWith('2', 'test-api-key');
  });

  it('should handle errors during session approval', async () => {
    const sessions: Session[] = [{ id: '1', state: 'AWAITING_PLAN_APPROVAL' }];
    vi.mocked(actions.fetchSessionsPage).mockResolvedValue({ sessions, nextPageToken: undefined });
    vi.mocked(idActions.approvePlan).mockRejectedValue(new Error('Approval failed'));

    await runAutoApprovalCheck({ schedule: false });

    expect(idActions.approvePlan).toHaveBeenCalledTimes(1);
  });
});
