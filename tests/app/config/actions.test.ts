
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
  appDatabase: {
      settings: {
          get: vi.fn()
      },
      profiles: {
          getActive: vi.fn().mockResolvedValue({ id: 'default', name: 'Default', isActive: true })
      }
  }
}));

describe('Config Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return the settings from the database', async () => {
      const mockSettings = { autoContinueEnabled: true, autoRetryEnabled: true };
      (db.appDatabase.settings.get as vi.Mock).mockResolvedValue(mockSettings);

      const settings = await getSettings();
      expect(db.appDatabase.settings.get).toHaveBeenCalledWith('default');
      expect(settings).toEqual(mockSettings);
    });

    it('should return null if no settings are found', async () => {
      (db.appDatabase.settings.get as vi.Mock).mockResolvedValue(null);

      const settings = await getSettings();
      expect(db.appDatabase.settings.get).toHaveBeenCalledWith('default');
      expect(settings).toBeNull();
    });
  });
});
