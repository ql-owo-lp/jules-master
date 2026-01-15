
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { getSettings } from '@/app/config/actions';
import { settingsClient } from '@/lib/grpc-client';

vi.mock('@/lib/grpc-client', () => ({
  settingsClient: {
    getSettings: vi.fn(),
  },
  // Mock other clients if necessary
  jobClient: {},
  promptClient: {},
  sessionClient: {},
}));

describe('Config Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return the settings from the grpc service', async () => {
      const mockSettings = { autoContinueEnabled: true, autoRetryEnabled: true };
      (settingsClient.getSettings as unknown as Mock).mockImplementation((req, callback) => {
          callback(null, mockSettings);
      });

      const settings = await getSettings();
      expect(settingsClient.getSettings).toHaveBeenCalled();
      expect(settings).toEqual(mockSettings);
    });

    it('should handle errors from grpc service', async () => {
      (settingsClient.getSettings as unknown as Mock).mockImplementation((req, callback) => {
          callback(new Error('Failed'), null);
      });

      await expect(getSettings()).rejects.toThrow('Failed');
    });
  });
});
