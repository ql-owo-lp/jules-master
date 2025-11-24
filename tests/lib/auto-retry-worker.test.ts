
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAutoRetryCheck, _resetForTest } from '@/lib/auto-retry-worker';
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

describe('AutoRetryWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.JULES_API_KEY = 'test-api-key';
    vi.clearAllMocks();
    vi.mocked(db.limit).mockResolvedValue([{ autoRetryEnabled: true, autoRetryMessage: 'Retry?' }]);
  });

  afterEach(() => {
    _resetForTest();
    vi.useRealTimers();
    delete process.env.JULES_API_KEY;
  });

  it('should not run if auto-retry is disabled', async () => {
    vi.mocked(db.limit).mockResolvedValueOnce([{ autoRetryEnabled: false }]);
    await runAutoRetryCheck({ schedule: false });
    expect(actions.getSession).not.toHaveBeenCalled();
  });

  it('should send a retry message to a failed session', async () => {
    const session: Session = { id: '1', state: 'FAILED', updateTime: new Date().toISOString() };
    vi.mocked(db.then).mockImplementationOnce((resolve) => resolve([{ sessionIds: '["1"]' }]));
    vi.mocked(actions.getSession).mockResolvedValue(session);
    vi.mocked(actions.listActivities).mockResolvedValue([]);
    await runAutoRetryCheck({ schedule: false });
    expect(actions.sendMessage).toHaveBeenCalledWith('1', 'Retry?', 'test-api-key');
  });

  it('should not send a message if the session is not failed', async () => {
    const session: Session = { id: '1', state: 'COMPLETED', updateTime: new Date().toISOString() };
    vi.mocked(db.then).mockImplementationOnce((resolve) => resolve([{ sessionIds: '["1"]' }]));
    vi.mocked(actions.getSession).mockResolvedValue(session);
    await runAutoRetryCheck({ schedule: false });
    expect(actions.sendMessage).not.toHaveBeenCalled();
  });

  it('should not send a message if the session was updated more than 24 hours ago', async () => {
    const session: Session = {
      id: '1',
      state: 'FAILED',
      updateTime: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    };
    vi.mocked(db.then).mockImplementationOnce((resolve) => resolve([{ sessionIds: '["1"]' }]));
    vi.mocked(actions.getSession).mockResolvedValue(session);
    await runAutoRetryCheck({ schedule: false });
    expect(actions.sendMessage).not.toHaveBeenCalled();
  });
});
