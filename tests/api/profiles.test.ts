
import { GET, POST, PUT, DELETE } from "@/app/api/profiles/route";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
  },
}));

describe("Profiles API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new profile", async () => {
    const request = new Request("http://localhost/api/profiles", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Profile",
        settings: {},
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const newProfile = await response.json();
    expect(newProfile.name).toBe("Test Profile");
  });

  it("should get all profiles", async () => {
    (db.select as vi.Mock).mockResolvedValue([{ id: "1", name: "Test Profile" }]);
    const response = await GET();
    const allProfiles = await response.json();
    expect(allProfiles.length).toBe(1);
    expect(allProfiles[0].name).toBe("Test Profile");
  });

  it("should update a profile", async () => {
    const request = new Request("http://localhost/api/profiles", {
      method: "PUT",
      body: JSON.stringify({
        id: "1",
        name: "Updated Profile",
      }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(200);
  });

  it("should delete a profile", async () => {
    const request = new Request("http://localhost/api/profiles", {
      method: "DELETE",
      body: JSON.stringify({
        id: "1",
      }),
    });
    const response = await DELETE(request);
    expect(response.status).toBe(200);
    const allProfiles = await db.select().from(profiles);
    expect(allProfiles.length).toBe(0);
  });
});
