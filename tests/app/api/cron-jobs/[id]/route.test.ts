
import { describe, it, expect, vi } from 'vitest';
import { PUT, DELETE } from '@/app/api/cron-jobs/[id]/route';
import { NextRequest } from 'next/server';
import * as actions from '@/app/settings/actions';

vi.mock('@/app/settings/actions');

describe('Cron Job API', () => {
  it('should successfully update a cron job', async () => {
    const request = new NextRequest('http://localhost/api/cron-jobs/123', {
      method: 'PUT',
      body: JSON.stringify({ name: 'test' }),
    });

    const response = await PUT(request, { params: { id: '123' } });

    expect(response.status).toBe(200);
    expect(actions.updateCronJob).toHaveBeenCalledWith('123', { name: 'test' });
  });

  it('should successfully delete a cron job', async () => {
    const request = new NextRequest('http://localhost/api/cron-jobs/123', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: { id: '123' } });

    expect(response.status).toBe(200);
    expect(actions.deleteCronJob).toHaveBeenCalledWith('123');
  });
});
