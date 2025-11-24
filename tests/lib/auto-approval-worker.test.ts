
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startAutoApprovalWorker } from '@/lib/auto-approval-worker';
import * as actions from '@/app/sessions/actions';
import * as idActions from '@/app/sessions/[id]/actions';
import { db } from '@/lib/db';

vi.mock('@/lib/db');
vi.mock('@/app/sessions/actions');
vi.mock('@/app/sessions/[id]/actions');

// Helper to allow async operations to complete
const flushPromises = () => new Promise(process.nextTick);

describe('startAutoApprovalWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(global, 'setTimeout'); // Spy on setTimeout
    process.env.JULES_API_KEY = 'test-api-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks(); // Restore all mocks to their original state
  });

  it('should not run if JULES_API_KEY is not set', async () => {
    delete process.env.JULES_API_KEY;
    await startAutoApprovalWorker();
    await flushPromises();
    expect(vi.mocked(actions.fetchSessionsPage)).not.toHaveBeenCalled();
  });

  it('should approve pending sessions and schedule the next run', async () => {
    const sessions = [
      { id: '1', state: 'AWAITING_PLAN_APPROVAL' },
      { id: '2', state: 'RUNNING' },
      { id: '3', state: 'AWAITING_PLAN_APPROVAL' },
    ];
    vi.mocked(actions.fetchSessionsPage).mockResolvedValue({
      sessions,
      nextPageToken: undefined,
    });
    vi.mocked(idActions.approvePlan).mockResolvedValue(true);

    const dbCatchMock = vi.fn();
    const dbThenMock = vi.fn().mockImplementation((callback) => {
      callback([{ autoApprovalInterval: 60 }]);
      return { catch: dbCatchMock };
    });
    const queryBuilderMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({ then: dbThenMock }),
    };
    vi.mocked(db.select).mockReturnValue(queryBuilderMock as any);

    await startAutoApprovalWorker();
    await flushPromises(); // Wait for runAutoApprovalCheck to finish

    expect(actions.fetchSessionsPage).toHaveBeenCalledTimes(1);
    expect(idActions.approvePlan).toHaveBeenCalledTimes(2);
    expect(idActions.approvePlan).toHaveBeenCalledWith('1', 'test-api-key');
    expect(idActions.approvePlan).toHaveBeenCalledWith('3', 'test-api-key');
    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60 * 1000);
  });

  it('should handle pagination', async () => {
    const sessions1 = [{ id: '1', state: 'AWAITING_PLAN_APPROVAL' }];
    const sessions2 = [{ id: '2', state: 'AWAITING_PLAN_APPROVAL' }];
    vi.mocked(actions.fetchSessionsPage)
      .mockResolvedValueOnce({
        sessions: sessions1,
        nextPageToken: 'token',
      })
      .mockResolvedValueOnce({
        sessions: sessions2,
        nextPageToken: undefined,
      });
    vi.mocked(idActions.approvePlan).mockResolvedValue(true);

    const dbCatchMock = vi.fn();
    const dbThenMock = vi.fn().mockImplementation((callback) => {
      callback([{ autoApprovalInterval: 60 }]);
      return { catch: dbCatchMock };
    });
    const queryBuilderMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({ then: dbThenMock }),
    };
    vi.mocked(db.select).mockReturnValue(queryBuilderMock as any);

    await startAutoApprovalWorker();
    await flushPromises(); // Wait for the do-while loop to finish

    expect(actions.fetchSessionsPage).toHaveBeenCalledTimes(2);
    expect(idActions.approvePlan).toHaveBeenCalledTimes(2);
    expect(setTimeout).toHaveBeenCalledTimes(1);
  });

  it('should handle db error when fetching settings and use default interval', async () => {
    vi.mocked(actions.fetchSessionsPage).mockResolvedValue({
      sessions: [],
      nextPageToken: undefined,
    });

    const dbError = new Error('DB error');
    const dbCatchMock = vi.fn().mockImplementation((callback) => {
      callback(dbError);
    });
    const dbThenMock = vi.fn().mockReturnValue({ catch: dbCatchMock });
    const queryBuilderMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({ then: dbThenMock }),
    };
    vi.mocked(db.select).mockReturnValue(queryBuilderMock as any);

    await startAutoApprovalWorker();
    await flushPromises(); // Wait for runAutoApprovalCheck to finish

    expect(actions.fetchSessionsPage).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 60 * 1000);
  });
});
