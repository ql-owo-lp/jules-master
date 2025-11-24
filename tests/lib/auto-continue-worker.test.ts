
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAutoContinueCheck, _resetForTest } from '@/lib/auto-continue-worker';
import { db } from '@/lib/db';
import * as actions from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    then: vi.fn(),
  },
}));

vi.mock('@/app/sessions/[id]/actions', () => ({
  getSession: vi.fn(),
  sendMessage: vi.fn(),
  listActivities: vi.fn(),
}));

describe('AutoContinueWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.JULES_API_KEY = 'test-api-key';
    vi.clearAllMocks();
    vi.mocked(db.limit).mockResolvedValue([{ autoContinueEnabled: true, autoContinueMessage: 'Continue?' }]);
  });

  afterEach(() => {
    _resetForTest();
    vi.useRealTimers();
    delete process.env.JULES_API_KEY;
  });

  it('should not run if auto-continue is disabled', async () => {
    vi.mocked(db.limit).mockResolvedValueOnce([{ autoContinueEnabled: false }]);
    await runAutoContinueCheck({ schedule: false });
    expect(actions.getSession).not.toHaveBeenCalled();
  });

  it('should send a continue message to a completed session without a PR', async () => {
    const session: Session = { id: '1', state: 'COMPLETED', updateTime: new Date().toISOString() };
    vi.mocked(db.then).mockImplementationOnce((resolve) => resolve([{ sessionIds: '["1"]' }]));
    vi.mocked(actions.getSession).mockResolvedValue(session);
    vi.mocked(actions.listActivities).mockResolvedValue([]);
    await runAutoContinueCheck({ schedule: false });
    expect(actions.sendMessage).toHaveBeenCalledWith('1', 'Continue?', 'test-api-key');
  });

  it('should not send a message if the session is not completed', async () => {
    const session: Session = { id: '1', state: 'RUNNING', updateTime: new Date().toISOString() };
    vi.mocked(db.then).mockImplementationOnce((resolve) => resolve([{ sessionIds: '["1"]' }]));
    vi.mocked(actions.getSession).mockResolvedValue(session);
    await runAutoContinueCheck({ schedule: false });
    expect(actions.sendMessage).not.toHaveBeenCalled();
  });

  it('should not send a message if the session has a PR', async () => {
    const session: Session = {
      id: '1',
      state: 'COMPLETED',
      updateTime: new Date().toISOString(),
      outputs: [{ pullRequest: { url: 'http://example.com' } }],
    };
    vi.mocked(db.then).mockImplementationOnce((resolve) => resolve([{ sessionIds: '["1"]' }]));
    vi.mocked(actions.getSession).mockResolvedValue(session);
    await runAutoContinueCheck({ schedule: false });
    expect(actions.sendMessage).not.toHaveBeenCalled();
  });

  it('should not send a message if the session was updated more than 24 hours ago', async () => {
    const session: Session = {
      id: '1',
      state: 'COMPLETED',
      updateTime: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    };
    vi.mocked(db.then).mockImplementationOnce((resolve) => resolve([{ sessionIds: '["1"]' }]));
    vi.mocked(actions.getSession).mockResolvedValue(session);
    await runAutoContinueCheck({ schedule: false });
    expect(actions.sendMessage).not.toHaveBeenCalled();
  });
});
