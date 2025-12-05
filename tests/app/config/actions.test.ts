
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSettings } from '@/app/config/actions';
import * as db from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      settings: {
        findFirst: vi.fn(),
      },
      profiles: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: vi.fn(),
  },
  appDatabase: {
      jobs: { getAll: vi.fn(), create: vi.fn() },
      predefinedPrompts: { getAll: vi.fn(), createMany: vi.fn() },
      historyPrompts: { getRecent: vi.fn(), create: vi.fn(), update: vi.fn() },
      quickReplies: { getAll: vi.fn(), createMany: vi.fn() },
      globalPrompt: { get: vi.fn(), save: vi.fn() },
      repoPrompts: { get: vi.fn(), save: vi.fn() },
  }
}));

describe('Config Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return the settings from the database', async () => {
      const mockSettings = { autoContinueEnabled: true, autoRetryEnabled: true };
      // Mock db.select()...get()
      (db.db.get as vi.Mock).mockResolvedValue(mockSettings);

      const settings = await getSettings();
      // Since we mock getProfileId to return a value, it uses db.select
      expect(db.db.select).toHaveBeenCalled();
      expect(settings).toEqual(mockSettings);
    });

    it('should return null if no settings are found', async () => {
      (db.db.get as vi.Mock).mockResolvedValue(null);

      const settings = await getSettings();
      expect(db.db.select).toHaveBeenCalled();
      expect(settings).toBeNull(); // or undefined depending on return type of .get()
    });
  });
});
