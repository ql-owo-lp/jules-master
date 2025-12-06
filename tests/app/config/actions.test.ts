
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSettings } from '@/app/config/actions';
import * as db from '@/lib/db';
import * as schema from '@/lib/db/schema';

vi.mock('@/lib/db', () => ({
  getActiveProfileId: vi.fn().mockResolvedValue('profile-123'),
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn()
        }))
      }))
    })),
  },
}));

describe('Config Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return the settings from the database', async () => {
      const mockSettings = { autoContinueEnabled: true, autoRetryEnabled: true };

      const getMock = vi.fn().mockResolvedValue(mockSettings);
      const whereMock = vi.fn().mockReturnValue({ get: getMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      // @ts-ignore
      db.db.select.mockReturnValue({ from: fromMock });

      const settings = await getSettings();
      expect(db.db.select).toHaveBeenCalled();
      expect(fromMock).toHaveBeenCalledWith(schema.settings);
      expect(whereMock).toHaveBeenCalled(); // profile check
      expect(getMock).toHaveBeenCalled();
      expect(settings).toEqual(mockSettings);
    });

    it('should return undefined if no settings are found', async () => {
       const getMock = vi.fn().mockResolvedValue(undefined);
      const whereMock = vi.fn().mockReturnValue({ get: getMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      // @ts-ignore
      db.db.select.mockReturnValue({ from: fromMock });

      const settings = await getSettings();
      expect(db.db.select).toHaveBeenCalled();
      expect(settings).toBeUndefined();
    });
  });
});
