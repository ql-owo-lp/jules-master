
import { db } from "@/lib/db";
import { profiles, settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Profile } from "./types";

export class ProfileService {
  async getProfiles(): Promise<Profile[]> {
    return await db.select().from(profiles).orderBy(profiles.name);
  }

  async createProfile(name: string): Promise<Profile> {
    const id = crypto.randomUUID();
    const newProfile: Profile = {
      id,
      name,
      createdAt: new Date().toISOString(),
    };
    await db.insert(profiles).values(newProfile);
    return newProfile;
  }

  async deleteProfile(id: string): Promise<void> {
    if (id === 'default') {
      throw new Error("Cannot delete default profile");
    }
    // TODO: Handle cleanup of related entities? Or just CASCADE?
    // For now, foreign keys are NO ACTION, so this might fail if there are dependencies.
    // Ideally we should soft-delete or reassign to default.
    // But for this MVP, let's assume valid delete request.
    await db.delete(profiles).where(eq(profiles.id, id));
  }

  async updateProfile(id: string, name: string): Promise<void> {
    await db.update(profiles).set({ name }).where(eq(profiles.id, id));
  }

  async getProfile(id: string): Promise<Profile | undefined> {
    const result = await db.select().from(profiles).where(eq(profiles.id, id));
    return result[0];
  }

  /**
   * Ensures the 'default' profile exists.
   */
  async ensureDefaultProfile(): Promise<void> {
    const defaultProfile = await this.getProfile('default');
    if (!defaultProfile) {
      await db.insert(profiles).values({
        id: 'default',
        name: 'Default',
        createdAt: new Date().toISOString(),
      });
    }
  }
}

export const profileService = new ProfileService();
