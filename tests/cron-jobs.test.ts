
import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/cron-jobs/route';
import * as actions from '@/app/settings/actions';

vi.mock('@/app/settings/actions');

import { POST } from '@/app/api/cron-jobs/route';

describe('Cron Jobs API', () => {
  it('should return a 500 error when getCronJobs fails', async () => {
    const errorMessage = 'Database error';
    vi.mocked(actions.getCronJobs).mockRejectedValue(new Error(errorMessage));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: 'Failed to fetch cron jobs' });
  });

  it('should create a cron job with enabled set to false', async () => {
    const cronJobData = {
      name: 'Test Cron Job',
      schedule: '0 0 * * *',
      prompt: 'Test prompt',
      repo: 'test/repo',
      branch: 'main',
      enabled: false,
    };
    const request = new Request('http://localhost/api/cron-jobs', {
      method: 'POST',
      body: JSON.stringify(cronJobData),
    });

    await POST(request);

    expect(actions.createCronJob).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });
});
