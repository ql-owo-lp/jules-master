
import { describe, it, expect, beforeEach } from 'vitest';
import { getProfiles, createProfile, updateProfile, deleteProfile, setSelectedProfile } from '@/app/settings/profiles';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';

describe('profiles', () => {
  beforeEach(async () => {
    await db.delete(profiles);
    await createProfile({ name: 'Default' });
  });

  it('should get all profiles', async () => {
    const allProfiles = await getProfiles();
    expect(allProfiles.length).toBe(1);
    expect(allProfiles[0].name).toBe('Default');
  });

  it('should create a new profile', async () => {
    await createProfile({ name: 'Test Profile' });
    const allProfiles = await getProfiles();
    expect(allProfiles.length).toBe(2);
    expect(allProfiles.find(p => p.name === 'Test Profile')).toBeDefined();
  });

  it('should update a profile', async () => {
    const newProfile = await createProfile({ name: 'Test Profile' });
    const updatedProfile = { ...newProfile, name: 'Updated Profile' };
    await updateProfile(updatedProfile);
    const allProfiles = await getProfiles();
    expect(allProfiles.find(p => p.id === newProfile.id)?.name).toBe('Updated Profile');
  });

  it('should delete a profile', async () => {
    const newProfile = await createProfile({ name: 'Test Profile' });
    await deleteProfile(newProfile.id);
    const allProfiles = await getProfiles();
    expect(allProfiles.find(p => p.id === newProfile.id)).toBeUndefined();
  });

  it('should set the selected profile', async () => {
    const newProfile = await createProfile({ name: 'Test Profile' });
    await setSelectedProfile(newProfile.id);
    const allProfiles = await getProfiles();
    expect(allProfiles.find(p => p.id === newProfile.id)?.isSelected).toBe(true);
    expect(allProfiles.find(p => p.name === 'Default')?.isSelected).toBe(false);
  });
});
