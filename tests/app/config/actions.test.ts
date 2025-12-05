
import { getProfiles, getActiveProfile, saveProfile, deleteProfile } from "@/app/config/actions";
import { db } from "@/lib/db";
import { vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
  },
}));

describe("Config Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProfiles", () => {
    it("should return all profiles from the database", async () => {
      const mockProfiles = [{ id: "1", name: "Test Profile" }];
      (db.select as vi.Mock).mockResolvedValue(mockProfiles);
      const profiles = await getProfiles();
      expect(db.select).toHaveBeenCalled();
      expect(profiles).toEqual(mockProfiles);
    });
  });

  describe("getActiveProfile", () => {
    it("should return the active profile from the database", async () => {
      const mockProfile = { id: "1", name: "Test Profile", isActive: true };
      (db.where as vi.Mock).mockResolvedValue([mockProfile]);
      const profile = await getActiveProfile();
      expect(db.where).toHaveBeenCalledWith({ "isActive": true });
      expect(profile).toEqual(mockProfile);
    });
  });

  describe("saveProfile", () => {
    it("should save a new profile to the database", async () => {
      const mockProfile = { id: "1", name: "Test Profile", settings: {}, isActive: false };
      await saveProfile(mockProfile);
      expect(db.insert).toHaveBeenCalledWith("profiles");
      expect(db.values).toHaveBeenCalledWith(mockProfile);
    });
  });

  describe("deleteProfile", () => {
    it("should delete a profile from the database", async () => {
      await deleteProfile("1");
      expect(db.delete).toHaveBeenCalledWith("profiles");
      expect(db.where).toHaveBeenCalledWith({ "id": "1" });
    });
  });
});
