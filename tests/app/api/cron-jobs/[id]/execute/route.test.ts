
import { POST } from '@/app/api/cron-jobs/[id]/execute/route';
import { triggerCronJob } from '@/app/settings/actions';
import { NextRequest, NextResponse } from 'next/server';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/app/settings/actions', () => ({
  triggerCronJob: vi.fn(),
}));

describe('POST /api/cron-jobs/[id]/execute', () => {
  it('should successfully execute a cron job', async () => {
    const request = new NextRequest('http://localhost/api/cron-jobs/123/execute', {
      method: 'POST',
    });

    const params = Promise.resolve({ id: '123' });

    const response = await POST(request, { params });
    const json = await response.json();

    expect(triggerCronJob).toHaveBeenCalledWith('123');
    expect(json).toEqual({ success: true });
  });

  it('should return 500 if execution fails', async () => {
    vi.mocked(triggerCronJob).mockRejectedValueOnce(new Error('Execution failed'));

    const request = new NextRequest('http://localhost/api/cron-jobs/123/execute', {
      method: 'POST',
    });

    const params = Promise.resolve({ id: '123' });

    const response = await POST(request, { params });
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: 'Failed to execute cron job' });
  });
});
