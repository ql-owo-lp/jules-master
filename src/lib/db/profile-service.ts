
import { db } from './index';
import { profiles, settings, jobs, sessions, cronJobs, predefinedPrompts, historyPrompts, quickReplies, globalPrompt, repoPrompts } from './schema';
import { eq, and, not } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export type Profile = typeof profiles.$inferSelect;

const DEFAULT_PROFILE_NAME = 'Default Profile';

export class ProfileService {
  async ensureDefaultProfile(): Promise<Profile> {
    const existingProfiles = await db.select().from(profiles).limit(1);
    if (existingProfiles.length > 0) {
      // Return the first profile found, prioritizing active one
      const activeProfile = await db.select().from(profiles).where(eq(profiles.isActive, true)).limit(1);
        if (activeProfile.length > 0) {
            return activeProfile[0];
        }
      // If no active profile, make the first one active
      await db.update(profiles).set({ isActive: true }).where(eq(profiles.id, existingProfiles[0].id));
      return existingProfiles[0];
    }

    // Create default profile
    const newProfile: Profile = {
      id: randomUUID(),
      name: DEFAULT_PROFILE_NAME,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    await db.insert(profiles).values(newProfile);

    // Create default settings for the profile
    await db.insert(settings).values({
        profileId: newProfile.id
    });

    return newProfile;
  }

  async getAllProfiles(): Promise<Profile[]> {
    return db.select().from(profiles);
  }

  async getProfileById(id: string): Promise<Profile | undefined> {
    return db.select().from(profiles).where(eq(profiles.id, id)).get();
  }

  async createProfile(name: string): Promise<Profile> {
    const newProfile: Profile = {
      id: randomUUID(),
      name,
      isActive: false, // New profiles are not active by default
      createdAt: new Date().toISOString(),
    };

    await db.insert(profiles).values(newProfile);
     // Create default settings for the profile
     await db.insert(settings).values({
        profileId: newProfile.id
    });
    return newProfile;
  }

  async updateProfile(id: string, data: Partial<Pick<Profile, 'name'>>): Promise<void> {
    await db.update(profiles).set(data).where(eq(profiles.id, id));
  }

  async deleteProfile(id: string): Promise<void> {
    const profileList = await this.getAllProfiles();
    if (profileList.length <= 1) {
      throw new Error("Cannot delete the last profile.");
    }

    const profileToDelete = profileList.find(p => p.id === id);
    if (!profileToDelete) return;

    if (profileToDelete.isActive) {
        throw new Error("Cannot delete the active profile. Please switch to another profile first.");
    }

    await db.transaction(async (tx) => {
      // Delete associated data
      // Note: We might want to soft delete or archive, but for now hard delete
      await tx.delete(settings).where(eq(settings.profileId, id));
      await tx.delete(jobs).where(eq(jobs.profileId, id));
      await tx.delete(cronJobs).where(eq(cronJobs.profileId, id));
      await tx.delete(predefinedPrompts).where(eq(predefinedPrompts.profileId, id));
      await tx.delete(historyPrompts).where(eq(historyPrompts.profileId, id));
      await tx.delete(quickReplies).where(eq(quickReplies.profileId, id));
      await tx.delete(globalPrompt).where(eq(globalPrompt.profileId, id));
      await tx.delete(repoPrompts).where(eq(repoPrompts.profileId, id));
      await tx.delete(sessions).where(eq(sessions.profileId, id));

      // Finally delete the profile
      await tx.delete(profiles).where(eq(profiles.id, id));
    });
  }

  async setActiveProfile(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(profiles).set({ isActive: false }).where(not(eq(profiles.id, id)));
      await tx.update(profiles).set({ isActive: true }).where(eq(profiles.id, id));
    });
  }

  async getActiveProfile(): Promise<Profile> {
      const activeProfile = await db.select().from(profiles).where(eq(profiles.isActive, true)).get();
      if (activeProfile) return activeProfile;
      return this.ensureDefaultProfile();
  }
}

export const profileService = new ProfileService();
