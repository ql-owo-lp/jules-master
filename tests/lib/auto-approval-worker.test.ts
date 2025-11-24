import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startAutoApprovalWorker } from '../../src/lib/auto-approval-worker';
import * as actions from '../../src/app/sessions/actions';
import * as singleActions from '../../src/app/sessions/[id]/actions';
import * as db from '../../src/lib/db';
import { settings } from '../../src/lib/db/schema';

vi.mock('../../src/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ autoApprovalInterval: 60 }]),
  },
}));

vi.mock('../../src/app/sessions/actions', () => ({
  fetchSessionsPage: vi.fn(),
}));

vi.mock('../../src/app/sessions/[id]/actions', () => ({
  approvePlan: vi.fn(),
}));

describe('Auto Approval Worker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.JULES_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete process.env.JULES_API_KEY;
  });

  it('should not run if API key is not set', async () => {
    delete process.env.JULES_API_KEY;
    await startAutoApprovalWorker();
    expect(console.warn).toHaveBeenCalledWith("AutoApprovalWorker: JULES_API_KEY not set. Skipping check.");
    expect(actions.fetchSessionsPage).not.toHaveBeenCalled();
  });

  it('should approve pending sessions', async () => {
    const sessions = [
      { id: '1', state: 'AWAITING_PLAN_APPROVAL' },
      { id: '2', state: 'IN_PROGRESS' },
      { id: '3', state: 'AWAITING_PLAN_APPROVAL' },
    ];
    vi.mocked(actions.fetchSessionsPage).mockResolvedValueOnce({ sessions, nextPageToken: undefined });
    vi.mocked(singleActions.approvePlan).mockResolvedValue(true);

    await startAutoApprovalWorker();

    expect(actions.fetchSessionsPage).toHaveBeenCalledWith('test-api-key', undefined, 50);
    expect(singleActions.approvePlan).toHaveBeenCalledTimes(2);
    expect(singleActions.approvePlan).toHaveBeenCalledWith('1', 'test-api-key');
    expect(singleActions.approvePlan).toHaveBeenCalledWith('3', 'test-api-key');
    expect(console.log).toHaveBeenCalledWith('AutoApprovalWorker: Cycle complete. Processed 3 sessions, approved 2.');
  });

  it('should handle multiple pages of sessions', async () => {
    const sessions1 = [{ id: '1', state: 'AWAITING_PLAN_APPROVAL' }];
    const sessions2 = [{ id: '2', state: 'AWAITING_PLAN_APPROVAL' }];
    vi.mocked(actions.fetchSessionsPage)
      .mockResolvedValueOnce({ sessions: sessions1, nextPageToken: 'page2' })
      .mockResolvedValueOnce({ sessions: sessions2, nextPageToken: undefined });
    vi.mocked(singleActions.approvePlan).mockResolvedValue(true);

    await startAutoApprovalWorker();

    expect(actions.fetchSessionsPage).toHaveBeenCalledTimes(2);
    expect(singleActions.approvePlan).toHaveBeenCalledTimes(2);
  });

  it('should handle approval failures', async () => {
    const sessions = [{ id: '1', state: 'AWAITING_PLAN_APPROVAL' }];
    vi.mocked(actions.fetchSessionsPage).mockResolvedValueOnce({ sessions, nextPageToken: undefined });
    vi.mocked(singleActions.approvePlan).mockResolvedValue(false);

    await startAutoApprovalWorker();

    expect(console.error).toHaveBeenCalledWith('AutoApprovalWorker: Failed to approve session 1.');
  });
});