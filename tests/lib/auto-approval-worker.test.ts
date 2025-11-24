import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startAutoApprovalWorker } from '@/lib/auto-approval-worker';
import * as actions from '@/app/sessions/actions';
import * as idActions from '@/app/sessions/[id]/actions';
import * as db from '@/lib/db';

vi.mock('@/app/sessions/actions');
vi.mock('@/app/sessions/[id]/actions');
vi.mock('@/lib/db');

describe('startAutoApprovalWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.JULES_API_KEY = 'test-key';
    vi.spyOn(db.db, 'select').mockReturnValue({
        from: () => ({
            where: () => ({
                limit: () => Promise.resolve([{ autoApprovalInterval: 60 }]),
            }),
        }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete process.env.JULES_API_KEY;
  });

  it('should not run if JULES_API_KEY is not set', async () => {
    delete process.env.JULES_API_KEY;
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    startAutoApprovalWorker();
    await vi.waitUntil(() => consoleWarnSpy.mock.calls.length > 0);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'AutoApprovalWorker: JULES_API_KEY not set. Skipping check.'
    );
    consoleWarnSpy.mockRestore();
  });

  it('should fetch sessions and approve pending ones', async () => {
    const fetchSessionsPageSpy = vi.spyOn(actions, 'fetchSessionsPage').mockResolvedValueOnce({
      sessions: [
        { id: '1', state: 'AWAITING_PLAN_APPROVAL' },
        { id: '2', state: 'RUNNING' },
        { id: '3', state: 'AWAITING_PLAN_APPROVAL' },
      ],
      nextPageToken: undefined,
    });
    const approvePlanSpy = vi.spyOn(idActions, 'approvePlan').mockResolvedValue(true);

    startAutoApprovalWorker();

    await vi.waitUntil(() => approvePlanSpy.mock.calls.length === 2);

    expect(fetchSessionsPageSpy).toHaveBeenCalled();
    expect(approvePlanSpy).toHaveBeenCalledTimes(2);
    expect(approvePlanSpy).toHaveBeenCalledWith('1', 'test-key');
    expect(approvePlanSpy).toHaveBeenCalledWith('3', 'test-key');
  });

  it('should handle multiple pages of sessions', async () => {
    const fetchSessionsPageSpy = vi.spyOn(actions, 'fetchSessionsPage')
      .mockResolvedValueOnce({
        sessions: [{ id: '1', state: 'AWAITING_PLAN_APPROVAL' }],
        nextPageToken: 'page2',
      })
      .mockResolvedValueOnce({
        sessions: [{ id: '2', state: 'AWAITING_PLAN_APPROVAL' }],
        nextPageToken: undefined,
      });
    const approvePlanSpy = vi.spyOn(idActions, 'approvePlan').mockResolvedValue(true);

    startAutoApprovalWorker();
    await vi.waitUntil(() => approvePlanSpy.mock.calls.length === 2);


    expect(fetchSessionsPageSpy).toHaveBeenCalledTimes(2);
    expect(approvePlanSpy).toHaveBeenCalledTimes(2);
  });

  it('should handle API errors gracefully', async () => {
    const fetchSessionsPageSpy = vi.spyOn(actions, 'fetchSessionsPage').mockRejectedValueOnce(new Error('API Error'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    startAutoApprovalWorker();
    await vi.waitUntil(() => consoleErrorSpy.mock.calls.length > 0);

    expect(fetchSessionsPageSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AutoApprovalWorker: Error during check cycle:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});
