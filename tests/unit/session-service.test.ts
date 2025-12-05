
import { vi } from 'vitest';
import { upsertSession } from '@/lib/session-service';
import { db, appDatabase } from '@/lib/db';
import { Session } from '@/lib/types';

vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn(),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnValue([]),
  },
  appDatabase: {
    jobs: {
      update: vi.fn(),
    },
  },
}));

describe('session-service', () => {
  it('should upsert a session and update the corresponding job', async () => {
    const session: Session = {
      id: 'session-1',
      name: 'sessions/session-1',
      title: 'Test Session 1',
      prompt: '[TOPIC]: # (Test Job 1)',
      state: 'COMPLETED',
      createTime: new Date().toISOString(),
    };

    // @ts-ignore
    db.where.mockReturnValue([{
      id: 'job-1',
      name: 'Test Job 1',
      sessionIds: [],
      createdAt: new Date().toISOString(),
      repo: 'test-owner/test-repo',
      branch: 'main',
    }]);

    await upsertSession(session);

    expect(db.insert).toHaveBeenCalled();
    expect(appDatabase.jobs.update).toHaveBeenCalledWith('job-1', {
      sessionIds: ['session-1'],
    });
  });
});
