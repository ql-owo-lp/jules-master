
import { describe, it, expect, vi } from 'vitest';
import { createCronJob } from '@/app/settings/actions';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      cronJobs: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnThis(),
    values: vi.fn(),
  },
}));

describe('Cron Job Actions', () => {
  it('should throw an error when creating a cron job with a duplicate name', async () => {
    const existingJob = {
      id: '1',
      name: 'Test Job',
      schedule: '* * * * *',
      prompt: 'Test prompt',
      repo: 'test/repo',
      branch: 'main',
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      enabled: true,
      autoApproval: false,
      automationMode: 'FULL',
      requirePlanApproval: false,
      sessionCount: 1,
    };

    vi.mocked(db.query.cronJobs.findFirst).mockResolvedValue(existingJob);

    const newJobData = {
      name: 'Test Job',
      schedule: '* * * * *',
      prompt: 'Test prompt',
      repo: 'test/repo',
      branch: 'main',
    };

    await expect(createCronJob(newJobData)).rejects.toThrow(
      'Cron job with name "Test Job" already exists.'
    );
  });
});
