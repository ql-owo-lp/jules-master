
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startAutoApprovalWorker } from '@/lib/auto-approval-worker';
import * as sessionsActions from '@/app/sessions/actions';
import * as idActions from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (callback: (result: any) => void) => Promise.resolve(callback([])),
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
    process.env.JULES_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    delete process.env.JULES_API_KEY;
  });

  it('should not run if JULES_API_KEY is not set', async () => {
    delete process.env.JULES_API_KEY;
    await startAutoApprovalWorker();
    expect(sessionsActions.fetchSessionsPage).not.toHaveBeenCalled();
  });

  it('should fetch sessions and approve pending ones', async () => {
    const sessions: Session[] = [
      { id: '1', state: 'AWAITING_PLAN_APPROVAL' },
      { id: '2', state: 'RUNNING' },
      { id: '3', state: 'AWAITING_PLAN_APPROVAL' },
    ] as any;

    vi.mocked(sessionsActions.fetchSessionsPage).mockResolvedValue({
      sessions,
      nextPageToken: undefined,
    });
    vi.mocked(idActions.approvePlan).mockResolvedValue(true);

    await startAutoApprovalWorker();

    expect(sessionsActions.fetchSessionsPage).toHaveBeenCalledWith('test-api-key', undefined, 50);
    expect(idActions.approvePlan).toHaveBeenCalledTimes(2);
    expect(idActions.approvePlan).toHaveBeenCalledWith('1', 'test-api-key');
    expect(idActions.approvePlan).toHaveBeenCalledWith('3', 'test-api-key');
  });

  it('should handle multiple pages of sessions', async () => {
    const sessions1: Session[] = [{ id: '1', state: 'AWAITING_PLAN_APPROVAL' }] as any;
    const sessions2: Session[] = [{ id: '2', state: 'AWAITING_PLAN_APPROVAL' }] as any;

    vi.mocked(sessionsActions.fetchSessionsPage)
      .mockResolvedValueOnce({ sessions: sessions1, nextPageToken: 'page2' })
      .mockResolvedValueOnce({ sessions: sessions2, nextPageToken: undefined });
    vi.mocked(idActions.approvePlan).mockResolvedValue(true);

    await startAutoApprovalWorker();

    expect(sessionsActions.fetchSessionsPage).toHaveBeenCalledTimes(2);
    expect(sessionsActions.fetchSessionsPage).toHaveBeenNthCalledWith(1, 'test-api-key', undefined, 50);
    expect(sessionsActions.fetchSessionsPage).toHaveBeenNthCalledWith(2, 'test-api-key', 'page2', 50);
    expect(idActions.approvePlan).toHaveBeenCalledTimes(2);
  });

  it('should handle errors during session approval', async () => {
    const sessions: Session[] = [
      { id: '1', state: 'AWAITING_PLAN_APPROVAL' },
      { id: '2', state: 'AWAITING_PLAN_APPROVAL' },
    ] as any;

    vi.mocked(sessionsActions.fetchSessionsPage).mockResolvedValue({
      sessions,
      nextPageToken: undefined,
    });
    vi.mocked(idActions.approvePlan).mockRejectedValueOnce(new Error('Approval failed'));
    vi.mocked(idActions.approvePlan).mockResolvedValueOnce(true);

    await startAutoApprovalWorker();

    expect(idActions.approvePlan).toHaveBeenCalledTimes(2);
  });
});
