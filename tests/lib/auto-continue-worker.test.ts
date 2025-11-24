
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startAutoContinueWorker } from '@/lib/auto-continue-worker';
import * as idActions from '@/app/sessions/[id]/actions';
import * as db from '@/lib/db';
import { settings, jobs } from '@/lib/db/schema';

vi.mock('@/app/sessions/[id]/actions');
vi.mock('@/lib/db');

describe('startAutoContinueWorker', () => {
  let settingsMock: any;
  let jobsMock: any;

  beforeEach(() => {
    vi.useFakeTimers();
    process.env.JULES_API_KEY = 'test-key';

    // Default mocks
    settingsMock = [{ autoContinueEnabled: true, autoContinueMessage: 'Continue?', autoApprovalInterval: 60 }];
    jobsMock = [{ id: 'job1', sessionIds: '["1"]' }];

    vi.spyOn(db.db, 'select').mockImplementation(() => ({
      from: (table: any) => {
        if (table === settings) {
          return {
            where: () => ({
              limit: () => Promise.resolve(settingsMock),
            }),
          };
        }
        if (table === jobs) {
          return Promise.resolve(jobsMock);
        }
        return Promise.resolve([]);
      },
    } as any));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete process.env.JULES_API_KEY;
  });

  it('should not run if auto-continue is disabled', async () => {
    settingsMock = [{ autoContinueEnabled: false, autoContinueMessage: 'Continue?', autoApprovalInterval: 60 }];
    const getSessionSpy = vi.spyOn(idActions, 'getSession');
    startAutoContinueWorker();

    await vi.advanceTimersByTimeAsync(1);

    expect(getSessionSpy).not.toHaveBeenCalled();
  });

  it('should send continue message to completed sessions without a PR', async () => {
    jobsMock = [{ id: 'job1', sessionIds: '["1", "2"]' }];
    const getSessionSpy = vi.spyOn(idActions, 'getSession')
      .mockResolvedValueOnce({ id: '1', state: 'COMPLETED', updateTime: new Date().toISOString() })
      .mockResolvedValueOnce({ id: '2', state: 'RUNNING', updateTime: new Date().toISOString() });
    const listActivitiesSpy = vi.spyOn(idActions, 'listActivities').mockResolvedValue([]);
    const sendMessageSpy = vi.spyOn(idActions, 'sendMessage').mockResolvedValue(true);

    startAutoContinueWorker();

    await vi.waitUntil(() => sendMessageSpy.mock.calls.length > 0);

    expect(getSessionSpy).toHaveBeenCalledTimes(2);
    expect(sendMessageSpy).toHaveBeenCalledOnce();
    expect(sendMessageSpy).toHaveBeenCalledWith('1', 'Continue?', 'test-key');
  });

  it('should not send a message if one was already sent', async () => {
    const getSessionSpy = vi.spyOn(idActions, 'getSession').mockResolvedValue({ id: '1', state: 'COMPLETED', updateTime: new Date().toISOString() });
    const listActivitiesSpy = vi.spyOn(idActions, 'listActivities').mockResolvedValue([
      { createTime: new Date().toISOString(), userMessaged: { userMessage: 'Continue?' } },
    ]);
    const sendMessageSpy = vi.spyOn(idActions, 'sendMessage');

    startAutoContinueWorker();
    await vi.waitUntil(() => listActivitiesSpy.mock.calls.length > 0);

    expect(sendMessageSpy).not.toHaveBeenCalled();
  });
});
