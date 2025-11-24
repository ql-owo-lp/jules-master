import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startAutoContinueWorker } from '../../src/lib/auto-continue-worker';
import * as actions from '../../src/app/sessions/[id]/actions';
import * as dbModule from '../../src/lib/db';

vi.mock('../../src/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  },
}));

vi.mock('../../src/app/sessions/[id]/actions', () => ({
  getSession: vi.fn(),
  sendMessage: vi.fn(),
  listActivities: vi.fn(),
}));

const mockDb = vi.mocked(dbModule.db);
const mockActions = vi.mocked(actions);

describe('Auto Continue Worker', () => {
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
    await startAutoContinueWorker();
    expect(console.warn).toHaveBeenCalledWith("AutoContinueWorker: JULES_API_KEY not set. Skipping check.");
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('should not run if auto-continue is disabled', async () => {
    const mockFrom = vi.fn().mockReturnThis();
    const mockWhere = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue([{ id: 1, autoContinueEnabled: false, autoContinueMessage: 'Continue?' }]);
    mockDb.select.mockReturnValue({ from: mockFrom, where: mockWhere, limit: mockLimit } as any);

    await startAutoContinueWorker();
    expect(mockActions.getSession).not.toHaveBeenCalled();
  });

  it('should send continue message to a completed session without a PR', async () => {
    // Mock the settings call
    vi.spyOn(mockDb, 'select').mockReturnValueOnce({
        from: () => ({
            where: () => ({
                limit: () => Promise.resolve([{ id: 1, autoContinueEnabled: true, autoContinueMessage: 'Continue?' }]),
            }),
        }),
    } as any);

    // Mock the jobs call
    vi.spyOn(mockDb, 'select').mockReturnValueOnce({
        from: () => Promise.resolve([{ id: 'job1', sessionIds: ['session1'] }]),
    } as any);

    mockActions.getSession.mockResolvedValue({
      id: 'session1',
      state: 'COMPLETED',
      updateTime: new Date().toISOString(),
      outputs: [],
    });
    mockActions.listActivities.mockResolvedValue([]);
    mockActions.sendMessage.mockResolvedValue({} as any);

    await startAutoContinueWorker();

    expect(mockActions.sendMessage).toHaveBeenCalledWith('session1', 'Continue?', 'test-api-key');
  });

  it('should not send a message if the last message was the continue prompt', async () => {
    vi.spyOn(mockDb, 'select').mockReturnValueOnce({
        from: () => ({
            where: () => ({
                limit: () => Promise.resolve([{ id: 1, autoContinueEnabled: true, autoContinueMessage: 'Continue?' }]),
            }),
        }),
    } as any);
    vi.spyOn(mockDb, 'select').mockReturnValueOnce({
        from: () => Promise.resolve([{ id: 'job1', sessionIds: ['session1'] }]),
    } as any);

    mockActions.getSession.mockResolvedValue({ id: 'session1', state: 'COMPLETED', updateTime: new Date().toISOString(), outputs: [] });
    mockActions.listActivities.mockResolvedValue([
      { createTime: new Date().toISOString(), userMessaged: { userMessage: 'Continue?' } }
    ] as any);

    await startAutoContinueWorker();

    expect(mockActions.sendMessage).not.toHaveBeenCalled();
  });

  it('should not send a message to a session that is not completed', async () => {
    vi.spyOn(mockDb, 'select').mockReturnValueOnce({
        from: () => ({
            where: () => ({
                limit: () => Promise.resolve([{ id: 1, autoContinueEnabled: true, autoContinueMessage: 'Continue?' }]),
            }),
        }),
    } as any);
    vi.spyOn(mockDb, 'select').mockReturnValueOnce({
        from: () => Promise.resolve([{ id: 'job1', sessionIds: ['session1'] }]),
    } as any);

    mockActions.getSession.mockResolvedValue({ id: 'session1', state: 'IN_PROGRESS', updateTime: new Date().toISOString(), outputs: [] });

    await startAutoContinueWorker();

    expect(mockActions.sendMessage).not.toHaveBeenCalled();
  });

  it('should not send a message to a session with a pull request', async () => {
    vi.spyOn(mockDb, 'select').mockReturnValueOnce({
        from: () => ({
            where: () => ({
                limit: () => Promise.resolve([{ id: 1, autoContinueEnabled: true, autoContinueMessage: 'Continue?' }]),
            }),
        }),
    } as any);
    vi.spyOn(mockDb, 'select').mockReturnValueOnce({
        from: () => Promise.resolve([{ id: 'job1', sessionIds: ['session1'] }]),
    } as any);

    mockActions.getSession.mockResolvedValue({
      id: 'session1',
      state: 'COMPLETED',
      updateTime: new Date().toISOString(),
      outputs: [{ pullRequest: { url: 'http://github.com/pr/1' } }],
    });

    await startAutoContinueWorker();

    expect(mockActions.sendMessage).not.toHaveBeenCalled();
  });

  it('should not process sessions updated more than 24 hours ago', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);

    vi.spyOn(mockDb, 'select').mockReturnValueOnce({
        from: () => ({
            where: () => ({
                limit: () => Promise.resolve([{ id: 1, autoContinueEnabled: true, autoContinueMessage: 'Continue?' }]),
            }),
        }),
    } as any);
    vi.spyOn(mockDb, 'select').mockReturnValueOnce({
        from: () => Promise.resolve([{ id: 'job1', sessionIds: ['session1'] }]),
    } as any);

    mockActions.getSession.mockResolvedValue({
      id: 'session1',
      state: 'COMPLETED',
      updateTime: yesterday.toISOString(),
      outputs: [],
    });

    await startAutoContinueWorker();

    expect(console.log).not.toHaveBeenCalledWith("AutoContinueWorker: Session session1 completed but no PR. Sending continue message...");
    expect(mockActions.sendMessage).not.toHaveBeenCalled();
  });
});