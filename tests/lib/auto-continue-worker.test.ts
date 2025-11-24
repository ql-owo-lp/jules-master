
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startAutoContinueWorker } from '@/lib/auto-continue-worker';
import * as actions from '@/app/sessions/[id]/actions';
import { db } from '@/lib/db';

vi.mock('@/lib/db');
vi.mock('@/app/sessions/[id]/actions');

const flushPromises = () => new Promise(process.nextTick);

describe('startAutoContinueWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(global, 'setTimeout');
    process.env.JULES_API_KEY = 'test-api-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should not run if JULES_API_KEY is not set', async () => {
    delete process.env.JULES_API_KEY;

    const dbCatchMock = vi.fn();
    const dbThenMock = vi.fn().mockReturnValue({ catch: dbCatchMock });
    const queryBuilderMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({ then: dbThenMock }),
    };
    vi.mocked(db.select).mockReturnValue(queryBuilderMock as any);

    await startAutoContinueWorker();
    await flushPromises();
    expect(vi.mocked(db.select)).toHaveBeenCalledTimes(1);
    expect(actions.getSession).not.toHaveBeenCalled();
  });

  it('should not run if auto-continue is disabled', async () => {
    const dbCatchMock = vi.fn();
    const dbThenMock = vi.fn().mockImplementation((callback) => {
      callback([{ autoContinueEnabled: false }]);
      return { catch: dbCatchMock };
    });
    const queryBuilderMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({ then: dbThenMock }),
    };
    vi.mocked(db.select).mockReturnValue(queryBuilderMock as any);

    await startAutoContinueWorker();
    await flushPromises();

    expect(db.select).toHaveBeenCalledTimes(2);
    expect(actions.getSession).not.toHaveBeenCalled();
  });

  it('should send continue message to completed sessions without PRs', async () => {
    const settingsCatchMock = vi.fn();
    const settingsThenMock = vi.fn().mockImplementation((callback) => {
      callback([{ autoContinueEnabled: true, autoContinueMessage: 'Continue?' }]);
      return { catch: settingsCatchMock };
    });
    const jobsCatchMock = vi.fn();
    const jobsThenMock = vi.fn().mockImplementation((callback) => {
      callback([{ sessionIds: ['1', '2'] }]);
      return { catch: jobsCatchMock };
    });

    const settingsQueryBuilderMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({ then: settingsThenMock }),
    };
    const jobsQueryBuilderMock = {
      from: vi.fn().mockReturnValue({ then: jobsThenMock }),
    };
    const scheduleQueryBuilderMock = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({ then: vi.fn().mockReturnValue({ catch: vi.fn() }) }),
    };
    vi.mocked(db.select)
      .mockReturnValueOnce(settingsQueryBuilderMock as any)
      .mockReturnValueOnce(jobsQueryBuilderMock as any)
      .mockReturnValue(scheduleQueryBuilderMock as any);

    vi.mocked(actions.getSession)
      .mockResolvedValueOnce({ id: '1', state: 'COMPLETED', updateTime: new Date().toISOString() } as any)
      .mockResolvedValueOnce({ id: '2', state: 'RUNNING', updateTime: new Date().toISOString() } as any);
    vi.mocked(actions.listActivities).mockResolvedValue([]);
    vi.mocked(actions.sendMessage).mockResolvedValue({} as any);

    await startAutoContinueWorker();
    await flushPromises();

    expect(actions.getSession).toHaveBeenCalledTimes(2);
    expect(actions.sendMessage).toHaveBeenCalledTimes(1);
    expect(actions.sendMessage).toHaveBeenCalledWith('1', 'Continue?', 'test-api-key');
    expect(setTimeout).toHaveBeenCalledTimes(1);
  });
});
