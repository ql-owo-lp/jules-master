
import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/cron-jobs/route';
vi.mock('@/app/settings/actions', () => ({
  getCronJobs: vi.fn(),
  createCronJob: vi.fn(),
}));

import { getCronJobs } from '@/app/settings/actions';

describe('GET /api/cron-jobs', () => {
  it('should return a 500 error when getCronJobs throws an error', async () => {
    vi.mocked(getCronJobs).mockRejectedValue(new Error('gRPC error'));

    const response = await GET();

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to fetch cron jobs');
  });
});
