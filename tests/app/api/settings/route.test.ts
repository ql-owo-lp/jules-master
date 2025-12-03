
import { POST } from '@/app/api/settings/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue({}),
  },
}));

describe('POST /api/settings', () => {
  it('should return a 400 error with detailed validation errors for invalid input', async () => {
    const invalidData = {
      idlePollInterval: 'not-a-number',
    };

    const req = new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
    expect(body.error.idlePollInterval).toEqual(['Expected number, received string']);
  });
});
