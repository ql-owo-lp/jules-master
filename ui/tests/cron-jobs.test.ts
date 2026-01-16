import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

describe('Cron Jobs API and Actions', () => {
    
  const mockCronJobClient = {
      listCronJobs: vi.fn(),
      toggleCronJob: vi.fn(),
  };

  beforeAll(() => {
    vi.doMock('@/lib/grpc-client', () => ({
      cronJobClient: mockCronJobClient,
    }));
  });
  
  afterAll(() => {
      vi.resetModules();
  });

  it('should return a 500 error when getCronJobs fails', async () => {
    // Mock failure
    mockCronJobClient.listCronJobs.mockImplementation((req: any, callback: any) => {
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
    
    mockCronJobClient.toggleCronJob.mockImplementation((req: any, callback: any) => {
        callback(null, {});
    });

    const { toggleCronJob } = await import('@/app/settings/actions');

    await toggleCronJob(cronJobId, enabled);

    expect(mockCronJobClient.toggleCronJob).toHaveBeenCalledTimes(1);
    expect(mockCronJobClient.toggleCronJob).toHaveBeenCalledWith(
        expect.objectContaining({ id: cronJobId, enabled }),
        expect.any(Function)
    );
  });
});
