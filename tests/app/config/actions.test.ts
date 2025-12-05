
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveProfile } from '@/app/config/actions';
import * as db from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      profiles: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe('Config Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveProfile', () => {
    it('should return the active profile from the database', async () => {
      const mockProfile = { name: 'default', isActive: true };
      (db.db.query.profiles.findFirst as vi.Mock).mockResolvedValue(mockProfile);

      const profile = await getActiveProfile();
      expect(db.db.query.profiles.findFirst).toHaveBeenCalled();
      expect(profile).toEqual(mockProfile);
    });

    it('should return null if no active profile is found', async () => {
      (db.db.query.profiles.findFirst as vi.Mock).mockResolvedValue(null);

      const profile = await getActiveProfile();
      expect(db.db.query.profiles.findFirst).toHaveBeenCalled();
      expect(profile).toBeNull();
    });
  });
});
