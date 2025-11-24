
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startAutoContinueWorker } from '../../src/lib/auto-continue-worker';
import * as idActions from '@/app/sessions/[id]/actions';
import { db } from '../../src/lib/db';
import { settings } from '../../src/lib/db/schema';
import { jobs } from '../../src/lib/db/schema';

vi.mock('@/app/sessions/[id]/actions');
vi.mock('../../src/lib/db');

describe('AutoContinueWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not run if JULES_API_KEY is not set', async () => {
    // @ts-ignore
    vi.mocked(db.select).mockReturnValue({
        from: (table) => ({
            where: () => ({
                limit: () =>
                Promise.resolve([
                    {
                    autoContinueEnabled: true,
                    autoContinueMessage: 'Continue?',
                    autoApprovalInterval: 60,
                    },
                ]),
            }),
            // @ts-ignore
            then: (callback) => callback([]),
        }),
    });
    await startAutoContinueWorker();
    expect(idActions.getSession).not.toHaveBeenCalled();
  });

  it('should send continue message to completed sessions without PRs', async () => {
    process.env.JULES_API_KEY = 'test-api-key';
    const mockJobs = [
      { id: '1', sessionIds: '["session-1", "session-2"]' },
      { id: '2', sessionIds: '["session-3"]' },
    ];
    const mockSession1 = { id: 'session-1', state: 'COMPLETED', outputs: [], updateTime: new Date().toISOString() };
    const mockSession2 = {
      id: 'session-2',
      state: 'COMPLETED',
      outputs: [{ pullRequest: { url: 'https://github.com/pr' } }],
      updateTime: new Date().toISOString(),
    };
    const mockSession3 = { id: 'session-3', state: 'RUNNING', outputs: [], updateTime: new Date().toISOString() };

    // @ts-ignore
    vi.mocked(db.select).mockImplementation(() => {
        return {
            from: (table) => {
                if (table === settings) {
                    return {
                        where: () => ({
                            limit: () => Promise.resolve([{
                                autoContinueEnabled: true,
                                autoContinueMessage: 'Continue?',
                                autoApprovalInterval: 60
                            }])
                        })
                    }
                } else {
                    return Promise.resolve(mockJobs);
                }
            }
        }
    });

    vi.mocked(idActions.getSession)
      // @ts-ignore
      .mockResolvedValueOnce(mockSession1)
      .mockResolvedValueOnce(mockSession2)
      .mockResolvedValueOnce(mockSession3);
    vi.mocked(idActions.listActivities).mockResolvedValue([]);
    vi.mocked(idActions.sendMessage).mockResolvedValue(true);

    await startAutoContinueWorker();

    expect(idActions.getSession).toHaveBeenCalledTimes(3);
    expect(idActions.sendMessage).toHaveBeenCalledTimes(1);
    expect(idActions.sendMessage).toHaveBeenCalledWith('session-1', 'Continue?', 'test-api-key');
  });
});
