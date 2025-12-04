
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processCronJobs } from '@/lib/cron-worker';
import { db } from '@/lib/db';
import { cronJobs, jobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { CronJob } from '@/lib/types';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      prepare: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnThis(),
      get: vi.fn().mockReturnThis(),
      all: vi.fn().mockReturnThis(),
    })),
  };
});

// Mock cron-parser
vi.mock('cron-parser', () => ({
    parseExpression: vi.fn((schedule) => {
        if (schedule === '* * * * *') {
            return {
                prev: () => ({
                    toDate: () => new Date(Date.now() - 60000) // 1 minute ago
                })
            }
        }
        if (schedule === '0 0 1 1 *') {
            return {
                prev: () => ({
                    toDate: () => new Date(Date.now() - 31536000000) // 1 year ago (approx)
                })
            }
        }
        throw new Error('Invalid cron expression');
    }),
}));

describe('processCronJobs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a job if cron job is due', async () => {
        const mockCronJob: CronJob = {
            id: 'cron-1',
            name: 'Test Cron Job',
            schedule: '* * * * *', // Every minute
            prompt: 'Test Prompt',
            repo: 'test/repo',
            branch: 'main',
            createdAt: new Date(Date.now() - 600000).toISOString(), // Created 10 mins ago
            lastRunAt: new Date(Date.now() - 120000).toISOString(), // Last run 2 mins ago
            enabled: true,
            autoApproval: false,
        };

        (db.select as any).mockReturnValue({
            from: vi.fn().mockResolvedValue([mockCronJob]),
        });

        const insertMock = vi.fn().mockResolvedValue(undefined);
        (db.insert as any).mockReturnValue({
            values: insertMock,
        });

        const updateMock = vi.fn().mockReturnValue({
             where: vi.fn().mockResolvedValue(undefined)
        });
        (db.update as any).mockReturnValue({
            set: updateMock,
        });

        await processCronJobs();

        expect(insertMock).toHaveBeenCalledTimes(1);
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            cronJobId: 'cron-1',
            name: 'Test Cron Job',
            repo: 'test/repo',
            branch: 'main',
            background: true,
        }));

        expect(updateMock).toHaveBeenCalledTimes(1);
    });

    it('should not create a job if cron job is not due', async () => {
         const mockCronJob: CronJob = {
            id: 'cron-1',
            name: 'Test Cron Job',
            schedule: '0 0 1 1 *', // Yearly
            prompt: 'Test Prompt',
            repo: 'test/repo',
            branch: 'main',
            createdAt: new Date().toISOString(),
            lastRunAt: new Date().toISOString(), // Just ran
            enabled: true,
            autoApproval: false,
        };

        (db.select as any).mockReturnValue({
            from: vi.fn().mockResolvedValue([mockCronJob]),
        });

        const insertMock = vi.fn().mockResolvedValue(undefined);
        (db.insert as any).mockReturnValue({
            values: insertMock,
        });

        await processCronJobs();

        expect(insertMock).not.toHaveBeenCalled();
    });

    it('should not create a job if cron job is disabled', async () => {
        const mockCronJob: CronJob = {
            id: 'cron-1',
            name: 'Test Cron Job',
            schedule: '* * * * *',
            prompt: 'Test Prompt',
            repo: 'test/repo',
            branch: 'main',
            createdAt: new Date(Date.now() - 600000).toISOString(),
            lastRunAt: new Date(Date.now() - 120000).toISOString(),
            enabled: false,
            autoApproval: false,
        };

        (db.select as any).mockReturnValue({
            from: vi.fn().mockResolvedValue([mockCronJob]),
        });

        const insertMock = vi.fn().mockResolvedValue(undefined);
        (db.insert as any).mockReturnValue({
            values: insertMock,
        });

        await processCronJobs();

        expect(insertMock).not.toHaveBeenCalled();
    });
});
