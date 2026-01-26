import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Cron Jobs API and Actions', () => {
    
  const mocks = {
      listCronJobs: vi.fn(),
      toggleCronJob: vi.fn(),
  };

  beforeEach(() => {
      vi.resetModules();
      vi.doMock('@/lib/grpc-client', () => ({
          cronJobClient: {
              listCronJobs: mocks.listCronJobs,
              toggleCronJob: mocks.toggleCronJob,
          },
      }));
  });

  it('should return a 500 error when getCronJobs fails', async () => {
    // Mock failure
    mocks.listCronJobs.mockImplementation((req: any, callback: any) => {
        callback(new Error('gRPC error'), null);
    });

    const { GET } = await import('@/app/api/cron-jobs/route');

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: 'Failed to fetch cron jobs' });
  });

  it('should call toggleCronJob via gRPC', async () => {
    const cronJobId = '123';
    const enabled = false;
    
    mocks.toggleCronJob.mockImplementation((req: any, callback: any) => {
        callback(null, {});
    });

    const { toggleCronJob } = await import('@/app/settings/actions');

    await toggleCronJob(cronJobId, enabled);

    expect(mocks.toggleCronJob).toHaveBeenCalledTimes(1);
    expect(mocks.toggleCronJob).toHaveBeenCalledWith(
        expect.objectContaining({ id: cronJobId, enabled }),
        expect.any(Function)
    );
  });
});
