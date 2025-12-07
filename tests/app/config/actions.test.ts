
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSettings, getProfiles, createProfile, renameProfile, deleteProfile, setActiveProfile } from '@/app/config/actions';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { settings as settingsSchema, profiles as profilesSchema } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      settings: {
        findFirst: vi.fn(),
      },
      profiles: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockReturnThis(),
    transaction: vi.fn(async (callback) => await callback(db)),
  },
}));

describe('Config Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.query.profiles.findFirst as vi.Mock).mockResolvedValue({ id: 'default', name: 'Default', isActive: true });
    (db.query.settings.findFirst as vi.Mock).mockResolvedValue({ profileId: 'default' });
  });

  describe('getSettings', () => {
    it('should return the settings for the active profile', async () => {
      const mockProfile = { id: 'active-profile', name: 'Active Profile', isActive: true };
      const mockSettings = { profileId: 'active-profile', autoContinueEnabled: true };
      (db.query.profiles.findFirst as vi.Mock).mockResolvedValue(mockProfile);
      (db.query.settings.findFirst as vi.Mock).mockResolvedValue(mockSettings);

      const settings = await getSettings();

      expect(db.query.profiles.findFirst).toHaveBeenCalled();
      expect(db.query.settings.findFirst).toHaveBeenCalled();
      expect(settings).toEqual(mockSettings);
    });

    it('should create a default profile and settings if no active profile exists', async () => {
      (db.query.profiles.findFirst as vi.Mock).mockResolvedValue(null);
      const defaultSettings = { profileId: 'default-profile-id' };
      (db.query.settings.findFirst as vi.Mock).mockResolvedValue(defaultSettings);

      const settings = await getSettings();

      expect(db.insert).toHaveBeenCalledTimes(2);
      expect(settings).toEqual(defaultSettings);
    });
  });

  describe('Profiles', () => {
    it('should get all profiles', async () => {
      const mockProfiles = [{ id: '1', name: 'Test Profile', isActive: true }];
      (db.query.profiles.findMany as vi.Mock).mockResolvedValue(mockProfiles);

      const profiles = await getProfiles();
      expect(db.query.profiles.findMany).toHaveBeenCalled();
      expect(profiles).toEqual(mockProfiles);
    });

    it('should create a new profile and clone settings from the active profile', async () => {
      const activeProfile = { id: 'active-id', name: 'Active', isActive: true };
      const activeSettings = { id: 'settings-id', profileId: 'active-id', setting: 'value' };
      (db.query.profiles.findFirst as vi.Mock).mockResolvedValue(activeProfile);
      (db.query.settings.findFirst as vi.Mock).mockResolvedValue(activeSettings);

      await createProfile('New Profile');

      expect(db.insert).toHaveBeenCalledWith(profilesSchema);
      expect(db.insert).toHaveBeenCalledWith(settingsSchema);
      expect(revalidatePath).toHaveBeenCalledWith('/settings');
    });

    it('should rename a profile', async () => {
      await renameProfile('1', 'New Name');

      expect(db.update).toHaveBeenCalledWith(profilesSchema);
      expect(db.set).toHaveBeenCalledWith({ name: 'New Name' });
      expect(db.where).toHaveBeenCalledWith(eq(profilesSchema.id, '1'));
      expect(revalidatePath).toHaveBeenCalledWith('/settings');
    });

    it('should not delete the active profile', async () => {
        (db.query.profiles.findMany as vi.Mock).mockResolvedValue([
            { id: '1', name: 'Active Profile', isActive: true },
            { id: '2', name: 'Another Profile', isActive: false },
        ]);
        (db.query.profiles.findFirst as vi.Mock).mockResolvedValue({ id: '1', name: 'Active Profile', isActive: true });

        await expect(deleteProfile('1')).rejects.toThrow('Cannot delete the active profile.');
        expect(db.delete).not.toHaveBeenCalled();
    });

    it('should not delete the last remaining profile', async () => {
        (db.query.profiles.findMany as vi.Mock).mockResolvedValue([{ id: '1', name: 'Only Profile', isActive: true }]);
        await expect(deleteProfile('1')).rejects.toThrow('Cannot delete the last profile.');
        expect(db.delete).not.toHaveBeenCalled();
    });

    it('should delete a profile and its settings', async () => {
      (db.query.profiles.findFirst as vi.Mock).mockResolvedValue({ id: '1', name: 'Test Profile', isActive: false });
      (db.query.profiles.findMany as vi.Mock).mockResolvedValue([
        { id: '1', name: 'To Delete', isActive: false },
        { id: '2', name: 'Another Profile', isActive: true }
      ]);

      await deleteProfile('1');

      expect(db.transaction).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalledWith(settingsSchema);
      expect(db.where).toHaveBeenCalledWith(eq(settingsSchema.profileId, '1'));
      expect(db.delete).toHaveBeenCalledWith(profilesSchema);
      expect(db.where).toHaveBeenCalledWith(eq(profilesSchema.id, '1'));
      expect(revalidatePath).toHaveBeenCalledWith('/settings');
    });
  });

  describe('setActiveProfile', () => {
    it('should set the selected profile to active and deactivate the old one', async () => {
      const oldActiveProfile = { id: 'old-active', name: 'Old Active', isActive: true };
      (db.query.profiles.findFirst as vi.Mock).mockResolvedValue(oldActiveProfile);

      await setActiveProfile('new-active');

      expect(db.transaction).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalledWith(profilesSchema);
      expect(db.set).toHaveBeenCalledWith({ isActive: false });
      expect(db.where).toHaveBeenCalledWith(eq(profilesSchema.id, 'old-active'));
      expect(db.update).toHaveBeenCalledWith(profilesSchema);
      expect(db.set).toHaveBeenCalledWith({ isActive: true });
      expect(db.where).toHaveBeenCalledWith(eq(profilesSchema.id, 'new-active'));
      expect(revalidatePath).toHaveBeenCalledWith('/settings');
    });

    it('should not do anything if the selected profile is already active', async () => {
      (db.query.profiles.findFirst as vi.Mock).mockResolvedValue({ id: '1', name: 'Already Active', isActive: true });

      await setActiveProfile('1');

      expect(db.transaction).not.toHaveBeenCalled();
    });
  });
});
