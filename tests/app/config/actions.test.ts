
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSettings } from '@/app/config/actions';
import * as db from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      settings: {
        findFirst: vi.fn(),
      },
    },
  },
}));

describe('Config Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return the settings from the database', async () => {
      const mockSettings = { autoContinueEnabled: true, autoRetryEnabled: true };
      (db.db.query.settings.findFirst as vi.Mock).mockResolvedValue(mockSettings);

      const settings = await getSettings();
      expect(db.db.query.settings.findFirst).toHaveBeenCalled();
      expect(settings).toEqual(mockSettings);
    });

    it('should return null if no settings are found', async () => {
      (db.db.query.settings.findFirst as vi.Mock).mockResolvedValue(null);

      const settings = await getSettings();
      expect(db.db.query.settings.findFirst).toHaveBeenCalled();
      expect(settings).toBeNull();
    });
  });
});
