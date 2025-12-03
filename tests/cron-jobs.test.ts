
import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/cron-jobs/route';
import * as actions from '@/app/settings/actions';

vi.mock('@/app/settings/actions');

describe('Cron Jobs API', () => {
  it('should return a 500 error when getCronJobs fails', async () => {
    const errorMessage = 'Database error';
    vi.mocked(actions.getCronJobs).mockRejectedValue(new Error(errorMessage));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: 'Failed to fetch cron jobs' });
  });
});
