
import { describe, it, expect, vi } from 'vitest';
import { updateCronJob } from '@/app/settings/actions';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn(),
  },
}));

describe('Cron Job Actions', () => {
  it('should not allow updating sensitive fields in a cron job', async () => {
    const maliciousData = {
      id: 'new-malicious-id',
    };

    await updateCronJob('old-id', maliciousData);

    const mockSet = vi.mocked(db.update).mock.results[0].value.set;
    expect(mockSet).toHaveBeenCalledWith(expect.not.objectContaining({ id: 'new-malicious-id' }));
  });
});
