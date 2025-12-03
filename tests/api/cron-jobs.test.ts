
import { describe, it, expect, vi } from 'vitest';
import { PUT } from '@/app/api/cron-jobs/[id]/route';
import { updateCronJob } from '@/app/settings/actions';

vi.mock('@/app/settings/actions');

describe('PUT /api/cron-jobs/[id]', () => {
  it('should update all fields in the request', async () => {
    const request = new Request('http://localhost/api/cron-jobs/123', {
      method: 'PUT',
      body: JSON.stringify({ name: 'new-name', enabled: false }),
    });

    const params = { id: '123' };
    await PUT(request, { params: Promise.resolve(params) });

    expect(updateCronJob).toHaveBeenCalledWith('123', { name: 'new-name', enabled: false });
  });
});
