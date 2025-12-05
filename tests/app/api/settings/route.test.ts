
import { describe, it, expect, vi } from 'vitest';
import { POST } from '@/app/api/settings/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Settings API', () => {
  it('should return a 400 error if profileId is missing', async () => {
    const request = new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify({ idlePollInterval: 120 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Profile ID is required');
  });

  it('should return a 400 error if the request body is empty (except profileId)', async () => {
    const request = new NextRequest('http://localhost/api/settings?profileId=test-profile', {
      method: 'POST',
      body: JSON.stringify({ profileId: 'test-profile' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('At least one setting must be provided.');
  });

  it('should return a 400 error if the request body is invalid', async () => {
    const request = new NextRequest('http://localhost/api/settings?profileId=test-profile', {
      method: 'POST',
      body: JSON.stringify({ profileId: 'test-profile', idlePollInterval: 'not-a-number' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.idlePollInterval).toEqual(['Expected number, received string']);
  });
});
