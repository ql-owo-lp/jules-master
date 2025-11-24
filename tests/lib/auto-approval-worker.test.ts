
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startAutoApprovalWorker } from '../../src/lib/auto-approval-worker';
import * as actions from '@/app/sessions/actions';
import * as idActions from '@/app/sessions/[id]/actions';
import { db } from '../../src/lib/db';

vi.mock('@/app/sessions/actions');
vi.mock('@/app/sessions/[id]/actions');
vi.mock('../../src/lib/db');

describe('AutoApprovalWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    vi.mocked(db.select).mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ autoApprovalInterval: 60 }]),
        }),
      }),
    });
  });

  it('should not run if JULES_API_KEY is not set', async () => {
    await startAutoApprovalWorker();
    expect(actions.fetchSessionsPage).not.toHaveBeenCalled();
  });

  it('should fetch sessions and approve pending ones', async () => {
    process.env.JULES_API_KEY = 'test-api-key';
    const mockSessions = {
      sessions: [
        { id: '1', state: 'AWAITING_PLAN_APPROVAL' },
        { id: '2', state: 'RUNNING' },
        { id: '3', state: 'AWAITING_PLAN_APPROVAL' },
      ],
      nextPageToken: undefined,
    };
    vi.mocked(actions.fetchSessionsPage).mockResolvedValue(mockSessions);
    vi.mocked(idActions.approvePlan).mockResolvedValue(true);

    await startAutoApprovalWorker();

    expect(actions.fetchSessionsPage).toHaveBeenCalledWith('test-api-key', undefined, 50);
    expect(idActions.approvePlan).toHaveBeenCalledTimes(2);
    expect(idActions.approvePlan).toHaveBeenCalledWith('1', 'test-api-key');
    expect(idActions.approvePlan).toHaveBeenCalledWith('3', 'test-api-key');
  });
});
