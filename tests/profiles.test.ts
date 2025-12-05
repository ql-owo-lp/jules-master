
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createProfile, getProfiles, updateProfile, deleteProfile } from '../src/app/settings/actions';
import { db } from '../src/lib/db';
import { profiles } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Profile Actions', () => {
    beforeAll(async () => {
        await db.delete(profiles);
    });

    afterAll(async () => {
        await db.delete(profiles);
    });

    describe('Profiles', () => {
        beforeEach(async () => {
            await db.delete(profiles);
        });

        it('should create a and retrieve a profile using actions', async () => {
            await createProfile({ name: 'test' });
            const retrievedProfiles = await getProfiles();

            expect(retrievedProfiles).toBeDefined();
            expect(retrievedProfiles.length).toBe(1);
            expect(retrievedProfiles[0].name).toBe('test');
        });

        it('should update a profile', async () => {
            const newProfile = await createProfile({ name: 'test' });
            await updateProfile(newProfile.id, { name: 'test2' });
            const retrievedProfiles = await getProfiles();

            expect(retrievedProfiles).toBeDefined();
            expect(retrievedProfiles.length).toBe(1);
            expect(retrievedProfiles[0].name).toBe('test2');
        });

        it('should delete a profile', async () => {
            const newProfile = await createProfile({ name: 'test' });
            await deleteProfile(newProfile.id);
            const retrievedProfiles = await getProfiles();

            expect(retrievedProfiles).toBeDefined();
            expect(retrievedProfiles.length).toBe(1);
        });
    });
});
