
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAutoApprovalCheck } from '../../src/lib/auto-approval-worker';
import * as actions from '../../src/app/sessions/actions';
import * as singleActions from '../../src/app/sessions/[id]/actions';
import { db } from '../../src/lib/db';

vi.mock('../../src/app/sessions/actions');
vi.mock('../../src/app/sessions/[id]/actions');
vi.mock('../../src/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  }
}));

describe('AutoApprovalWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.JULES_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete process.env.JULES_API_KEY;
  });

  it('should not run if JULES_API_KEY is not set', async () => {
    delete process.env.JULES_API_KEY;
    const fetchSessionsPageSpy = vi.spyOn(actions, 'fetchSessionsPage');
    await runAutoApprovalCheck();
    expect(fetchSessionsPageSpy).not.toHaveBeenCalled();
  });

  it('should fetch sessions and approve pending ones', async () => {
    vi.spyOn(actions, 'fetchSessionsPage').mockResolvedValue({
      sessions: [
        { id: '1', state: 'AWAITING_PLAN_APPROVAL' },
        { id: '2', state: 'RUNNING' },
        { id: '3', state: 'AWAITING_PLAN_APPROVAL' },
      ],
      nextPageToken: undefined,
    });
    const approvePlanSpy = vi.spyOn(singleActions, 'approvePlan').mockResolvedValue(true);

    await runAutoApprovalCheck();

    expect(actions.fetchSessionsPage).toHaveBeenCalledTimes(1);
    expect(approvePlanSpy).toHaveBeenCalledTimes(2);
    expect(approvePlanSpy).toHaveBeenCalledWith('1', 'test-api-key');
    expect(approvePlanSpy).toHaveBeenCalledWith('3', 'test-api-key');
  });

  it('should handle pagination correctly', async () => {
    const fetchSessionsPageSpy = vi.spyOn(actions, 'fetchSessionsPage')
      .mockResolvedValueOnce({
        sessions: [{ id: '1', state: 'AWAITING_PLAN_APPROVAL' }],
        nextPageToken: 'page2',
      })
      .mockResolvedValueOnce({
        sessions: [{ id: '2', state: 'AWAITING_PLAN_APPROVAL' }],
        nextPageToken: undefined,
      });
    const approvePlanSpy = vi.spyOn(singleActions, 'approvePlan').mockResolvedValue(true);

    await runAutoApprovalCheck();

    expect(fetchSessionsPageSpy).toHaveBeenCalledTimes(2);
    expect(approvePlanSpy).toHaveBeenCalledTimes(2);
  });

  it('should schedule next run with interval from settings', async () => {
    vi.spyOn(db, 'select').mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ autoApprovalInterval: 30 }]),
    } as any);
     vi.spyOn(actions, 'fetchSessionsPage').mockResolvedValue({
      sessions: [],
      nextPageToken: undefined,
    });

    await runAutoApprovalCheck();

    expect(vi.getTimerCount()).toBe(1);
  });
});
