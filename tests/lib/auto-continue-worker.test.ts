
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAutoContinueCheck, _resetForTest } from '@/lib/auto-continue-worker';
import { db } from '@/lib/db';
import * as actions from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';
import * as schema from '@/lib/db/schema';

// Helper to create a chainable mock that acts as a Promise and has methods
const createQueryBuilder = (resolvedValue: any) => {
    const builder: any = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        then: (resolve: any, reject: any) => {
             // If we have a resolved value configured for this specific chain/query, return it.
             // But how do we distinguish?
             // We can let the test configure what the final result is.
             // For now, let's assume resolvedValue is returned.
             return Promise.resolve(resolvedValue).then(resolve, reject);
        }
    };
    return builder;
};

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn(), // We will mock implementation in tests
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
  });

  afterEach(() => {
    _resetForTest();
    vi.useRealTimers();
    delete process.env.JULES_API_KEY;
  });

  it('should not run if auto-continue is disabled', async () => {
    // settings query
    (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ autoContinueEnabled: false }])
            })
        })
    });

    await runAutoContinueCheck({ schedule: false });
    expect(actions.getSession).not.toHaveBeenCalled();
  });

  it('should send a continue message to a completed session without a PR', async () => {
    const session: Session = { 
        id: '1', 
        name: 'sessions/1',
        title: 'Test',
        prompt: 'Test',
        state: 'COMPLETED', 
        updateTime: new Date().toISOString(),
        profileId: 'default'
    };
    const job = { sessionIds: '["1"]', createdAt: new Date().toISOString() };

    // Mock db queries
    (db.select as any).mockImplementation(() => ({
      from: vi.fn().mockImplementation((table) => {
        if (table === schema.settings) {
             return {
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([{ autoContinueEnabled: true, autoContinueMessage: 'Continue?' }])
                })
             };
        }
        if (table === schema.jobs) {
             // Return a Thenable (Promise-like) that resolves to [job]
             return {
                 where: vi.fn().mockResolvedValue([job])
             };
        }
        if (table === schema.sessions) {
             // Return a builder that has .where()
             return {
                 where: vi.fn().mockResolvedValue([]) // No cached session found, or found but ignored
             };
        }
        return Promise.resolve([]);
      })
    }));

    vi.mocked(actions.getSession).mockResolvedValue(session);
    vi.mocked(actions.listActivities).mockResolvedValue([]);

    await runAutoContinueCheck({ schedule: false });

    expect(actions.sendMessage).toHaveBeenCalledWith('1', 'Continue?', 'test-api-key', true);
  });

  it('should not send a message if the session is not completed', async () => {
    const session: Session = { 
        id: '1', 
        name: 'sessions/1',
        title: 'Test',
        prompt: 'Test',
        state: 'IN_PROGRESS', 
        updateTime: new Date().toISOString(),
        profileId: 'default'
    };
    const job = { sessionIds: '["1"]', createdAt: new Date().toISOString() };

    (db.select as any).mockImplementation(() => ({
      from: vi.fn().mockImplementation((table) => {
        if (table === schema.settings) {
             return {
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([{ autoContinueEnabled: true, autoContinueMessage: 'Continue?' }])
                })
             };
        }
        if (table === schema.jobs) {
             return {
                 where: vi.fn().mockResolvedValue([job])
             };
        }
        if (table === schema.sessions) {
             return {
                 where: vi.fn().mockResolvedValue([])
             };
        }
        return Promise.resolve([]);
      })
    }));

    vi.mocked(actions.getSession).mockResolvedValue(session);
    await runAutoContinueCheck({ schedule: false });
    expect(actions.sendMessage).not.toHaveBeenCalled();
  });

  it('should not send a message if the session has a PR', async () => {
    const session: Session = {
      id: '1',
      name: 'sessions/1',
      title: 'Test',
      prompt: 'Test',
      state: 'COMPLETED',
      updateTime: new Date().toISOString(),
      outputs: [{ pullRequest: { url: 'http://example.com', title: 'Test PR', description: 'Test' } }],
      profileId: 'default'
    };
    const job = { sessionIds: '["1"]', createdAt: new Date().toISOString() };

    (db.select as any).mockImplementation(() => ({
      from: vi.fn().mockImplementation((table) => {
        if (table === schema.settings) {
             return {
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([{ autoContinueEnabled: true, autoContinueMessage: 'Continue?' }])
                })
             };
        }
        if (table === schema.jobs) {
             return {
                 where: vi.fn().mockResolvedValue([job])
             };
        }
        if (table === schema.sessions) {
             return {
                 where: vi.fn().mockResolvedValue([])
             };
        }
        return Promise.resolve([]);
      })
    }));

    vi.mocked(actions.getSession).mockResolvedValue(session);
    await runAutoContinueCheck({ schedule: false });
    expect(actions.sendMessage).not.toHaveBeenCalled();
  });

  it('should not send a message if the session was updated more than 24 hours ago', async () => {
    const session: Session = {
      id: '1',
      name: 'sessions/1',
      title: 'Test',
      prompt: 'Test',
      state: 'COMPLETED',
      updateTime: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      profileId: 'default'
    };
    const job = { sessionIds: '["1"]', createdAt: new Date().toISOString() };

    (db.select as any).mockImplementation(() => ({
      from: vi.fn().mockImplementation((table) => {
        if (table === schema.settings) {
             return {
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([{ autoContinueEnabled: true, autoContinueMessage: 'Continue?' }])
                })
             };
        }
        if (table === schema.jobs) {
             return {
                 where: vi.fn().mockResolvedValue([job])
             };
        }
        if (table === schema.sessions) {
             return {
                 where: vi.fn().mockResolvedValue([])
             };
        }
        return Promise.resolve([]);
      })
    }));

    vi.mocked(actions.getSession).mockResolvedValue(session);
    await runAutoContinueCheck({ schedule: false });
    expect(actions.sendMessage).not.toHaveBeenCalled();
  });
});
