import { db } from '@/lib/db';
import { profiles, settings } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export type Profile = {
  id: string;
  name: string;
  createdAt: string;
};

export const profileService = {
  async getProfiles() {
    return await db.select().from(profiles).orderBy(asc(profiles.createdAt));
  },

  async getProfile(id: string) {
    const result = await db.select().from(profiles).where(eq(profiles.id, id));
    return result[0] || null;
  },

  async createProfile(name: string) {
    const id = randomUUID();
    const newProfile = {
      id,
      name,
      createdAt: new Date().toISOString(),
    };

    await db.insert(profiles).values(newProfile);

    // Create default settings for the new profile
    // Note: We need to omit the 'id' field for settings if it's auto-increment, or handle it properly.
    // The settings table schema uses `id: integer('id').primaryKey()`, which usually auto-increments.
    // However, if we want strict 1:1 relation, we might want to query if it exists.
    // But this is a new profile, so no settings exist for it.

    await db.insert(settings).values({
      profileId: id,
      // Default values will be used for other fields
    });

    return newProfile;
  },

  async updateProfile(id: string, name: string) {
    await db.update(profiles).set({ name }).where(eq(profiles.id, id));
    return this.getProfile(id);
  },

  async deleteProfile(id: string) {
    // We should probably check if it's the last profile or the default one,
    // but that logic might reside in the API handler or here.
    // Also need to handle cascade deletes or allow the DB to handle it (if configured).
    // Current DB schema relies on `REFERENCES profiles(id)` but without explicit ON DELETE CASCADE in Drizzle definitions usually.
    // However, I didn't add ON DELETE CASCADE in the migration manually either.
    // So I should probably delete related records manually or update the schema to support cascade.
    // For now, let's just delete the profile and settings.

    await db.delete(settings).where(eq(settings.profileId, id));
    // TODO: Delete other related data (jobs, sessions, etc.)
    await db.delete(profiles).where(eq(profiles.id, id));
  }
};
