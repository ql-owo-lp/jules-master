
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getProfiles, createProfile, updateProfile, deleteProfile, setActiveProfile, getActiveProfile } from '@/app/profiles/actions';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import type { Profile } from '@/lib/types';

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

describe('Profile Actions', () => {
    beforeEach(async () => {
        await db.delete(profiles).run();
    });

    it('should create a default profile if none exist', async () => {
        const allProfiles = await getProfiles();
        expect(allProfiles.length).toBe(1);
        expect(allProfiles[0].name).toBe('Default');
        expect(allProfiles[0].isActive).toBe(true);
    });

    it('should create a new profile', async () => {
        await getProfiles(); // Ensure default profile exists
        await createProfile('Test Profile');
        const allProfiles = await getProfiles();
        expect(allProfiles.length).toBe(2);
        expect(allProfiles.find((p) => p.name === 'Test Profile')).toBeDefined();
    });

    it('should update a profile', async () => {
        const allProfiles = await getProfiles();
        const profileToUpdate = allProfiles[0];
        const updatedProfile = { ...profileToUpdate, name: 'Updated Profile' };
        await updateProfile(updatedProfile);
        const updatedProfiles = await getProfiles();
        expect(updatedProfiles[0].name).toBe('Updated Profile');
    });

    it('should delete a profile', async () => {
        await getProfiles(); // Ensure default profile exists
        await createProfile('Test Profile');
        let allProfiles = await getProfiles();
        const profileToDelete = allProfiles.find((p) => p.name === 'Test Profile');
        await deleteProfile(profileToDelete!.id);
        allProfiles = await getProfiles();
        expect(allProfiles.length).toBe(1);
        expect(allProfiles.find((p) => p.name === 'Test Profile')).toBeUndefined();
    });

    it('should not delete the last profile', async () => {
        await getProfiles(); // Ensure default profile exists
        const allProfiles = await getProfiles();
        const profileToDelete = allProfiles[0];
        await deleteProfile(profileToDelete.id);
        const remainingProfiles = await getProfiles();
        expect(remainingProfiles.length).toBe(1);
    });

    it('should set a profile as active', async () => {
        await getProfiles(); // Ensure default profile exists
        await createProfile('Test Profile');
        let allProfiles = await getProfiles();
        const profileToActivate = allProfiles.find((p) => p.name === 'Test Profile');
        await setActiveProfile(profileToActivate!.id);
        const activeProfile = await getActiveProfile();
        expect(activeProfile!.name).toBe('Test Profile');
    });
});
