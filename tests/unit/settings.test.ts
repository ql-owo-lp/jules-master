
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/settings/route';
import { NextRequest } from 'next/server';

describe('POST /api/settings', () => {
  it('should return 400 for invalid data', async () => {
    const invalidData = {
      idlePollInterval: 'not-a-number',
    };
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
