
import { describe, it, expect, vi } from 'vitest';
import { PUT } from '@/app/api/cron-jobs/[id]/route';
import { updateCronJob, toggleCronJob } from '@/app/settings/actions';

vi.mock('@/app/settings/actions');

describe('PUT /api/cron-jobs/[id]', () => {
  it('should update all fields in the request, not just the enabled status', async () => {
    const request = new Request('http://localhost/api/cron-jobs/123', {
      method: 'PUT',
      body: JSON.stringify({ name: 'new-name', enabled: false }),
    });

    const params = { id: '123' };
    await PUT(request, { params: Promise.resolve(params) });

    expect(toggleCronJob).toHaveBeenCalledWith('123', false);
    expect(updateCronJob).toHaveBeenCalledWith('123', { name: 'new-name' });
  });
});
