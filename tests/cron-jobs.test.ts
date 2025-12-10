import { describe, it, expect, vi, beforeAll } from 'vitest';

describe('Cron Jobs API and Actions', () => {
  const mockDb = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(() => {
    vi.doMock('@/lib/db', () => ({
      db: mockDb,
    }));
  });

  it('should return a 500 error when getCronJobs fails', async () => {
    vi.resetModules();
    const errorMessage = 'Database error';

    vi.doMock('@/app/settings/actions', async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...(actual as any),
        getCronJobs: vi.fn().mockRejectedValue(new Error(errorMessage)),
      };
    });

    const { GET } = await import('@/app/api/cron-jobs/route');

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: 'Failed to fetch cron jobs' });
  });

  it('should update updatedAt field when toggleCronJob is called', async () => {
    vi.resetModules();
    const cronJobId = '123';
    const enabled = false;

    const { toggleCronJob } = await import('@/app/settings/actions');

    await toggleCronJob(cronJobId, enabled);

    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled,
        updatedAt: expect.any(String),
      })
    );
    expect(mockDb.where).toHaveBeenCalledTimes(1);
  });
});
