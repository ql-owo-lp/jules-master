
import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/cron-jobs/route';
import * as actions from '@/app/settings/actions';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn(),
  },
}));

describe('GET /api/cron-jobs', () => {
  it('should return a 500 error when getCronJobs throws an error', async () => {
    vi.spyOn(db as any, 'orderBy').mockRejectedValue(new Error('Database error'));

    const response = await GET();

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Failed to fetch cron jobs');
  });
});
