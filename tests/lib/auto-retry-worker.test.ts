
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAutoRetryCheck } from '../../src/lib/auto-retry-worker';
import * as actions from '../../src/app/sessions/[id]/actions';
import { db } from '../../src/lib/db';
import { settings, jobs } from '../../src/lib/db/schema';
import { Session } from '@/lib/types';

vi.mock('../../src/app/sessions/[id]/actions');
vi.mock('../../src/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  }
}));

describe('AutoRetryWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.JULES_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete process.env.JULES_API_KEY;
  });

  it('should not run if autoRetry is disabled', async () => {
    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ autoRetryEnabled: false }]),
    } as any);
    const getSessionSpy = vi.spyOn(actions, 'getSession');
    await runAutoRetryCheck();
    expect(getSessionSpy).not.toHaveBeenCalled();
  });

  it('should send retry message to failed sessions', async () => {
    const selectFromSpy = vi.spyOn(db, 'select');
    selectFromSpy.mockImplementation(() => ({
      from: (table: any) => {
        if (table === settings) {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ autoRetryEnabled: true, autoRetryMessage: 'Retry?' }]),
          };
        }
        if (table === jobs) {
          return Promise.resolve([{ sessionIds: '["1"]' }]);
        }
        return {
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([])
        };
      },
    } as any));


    vi.spyOn(actions, 'getSession').mockResolvedValue({
      id: '1',
      state: 'FAILED',
    } as Session);
    vi.spyOn(actions, 'listActivities').mockResolvedValue([]);
    const sendMessageSpy = vi.spyOn(actions, 'sendMessage').mockResolvedValue(true);

    await runAutoRetryCheck();

    expect(actions.getSession).toHaveBeenCalledWith('1', 'test-api-key');
    expect(sendMessageSpy).toHaveBeenCalledWith('1', 'Retry?', 'test-api-key');
  });

  it('should not send retry message if session is not failed', async () => {
     const selectFromSpy = vi.spyOn(db, 'select');
    selectFromSpy.mockImplementation(() => ({
      from: (table: any) => {
        if (table === settings) {
          return {
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ autoRetryEnabled: true, autoRetryMessage: 'Retry?' }]),
          };
        }
        if (table === jobs) {
          return Promise.resolve([{ sessionIds: '["1"]' }]);
        }
        return {
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([])
        };
      },
    } as any));
    vi.spyOn(actions, 'getSession').mockResolvedValue({
      id: '1',
      state: 'COMPLETED',
    } as Session);
    const sendMessageSpy = vi.spyOn(actions, 'sendMessage');

    await runAutoRetryCheck();

    expect(sendMessageSpy).not.toHaveBeenCalled();
  });
});
