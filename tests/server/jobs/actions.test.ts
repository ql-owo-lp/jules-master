
import { vi, describe, it, expect, beforeEach } from "vitest";
import { createJob } from "@/app/jobs/actions";
import { generateTitle } from "@/ai/generate-title";
import { db } from "@/lib/db";
import { createSession as apiCreateSession } from "@/lib/jules-api";
import { revalidatePath } from "next/cache";

vi.mock("@/ai/generate-title");
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn(),
  },
}));
vi.mock("@/lib/jules-api");
vi.mock("next/cache");

describe("createJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a job with a generated title and sessions", async () => {
    const prompts = ["prompt1", "prompt2"];
    const jobName = "Test Job";
    const generatedTitle = "Generated Title";
    const job = { id: 1, name: jobName, sessionIds: [] };
    const session1 = { id: "session1" };
    const session2 = { id: "session2" };

    vi.mocked(generateTitle).mockResolvedValue(generatedTitle);
    vi.mocked(apiCreateSession)
      .mockResolvedValueOnce(session1)
      .mockResolvedValueOnce(session2);
    vi.mocked(db.returning).mockResolvedValue([job]);

    await createJob(prompts, jobName);

    expect(db.insert).toHaveBeenCalledWith(expect.any(Object));
    expect(db.values).toHaveBeenCalledWith({ name: jobName });
    expect(apiCreateSession).toHaveBeenCalledTimes(2);
    expect(apiCreateSession).toHaveBeenCalledWith("prompt1");
    expect(apiCreateSession).toHaveBeenCalledWith("prompt2");
    expect(db.update).toHaveBeenCalledWith(expect.any(Object));
    expect(db.set).toHaveBeenCalledWith({ sessionIds: ["session1", "session2"] });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("should create a job with an AI-generated title and sessions", async () => {
    const prompts = ["prompt1", "prompt2"];
    const generatedTitle = "Generated Title";
    const job = { id: 1, name: generatedTitle, sessionIds: [] };
    const session1 = { id: "session1" };
    const session2 = { id: "session2" };

    vi.mocked(generateTitle).mockResolvedValue(generatedTitle);
    vi.mocked(apiCreateSession)
      .mockResolvedValueOnce(session1)
      .mockResolvedValueOnce(session2);
    vi.mocked(db.returning).mockResolvedValue([job]);

    await createJob(prompts, "");

    expect(generateTitle).toHaveBeenCalledWith("prompt1\nprompt2");
    expect(db.insert).toHaveBeenCalledWith(expect.any(Object));
    expect(db.values).toHaveBeenCalledWith({ name: generatedTitle });
    expect(apiCreateSession).toHaveBeenCalledTimes(2);
    expect(apiCreateSession).toHaveBeenCalledWith("prompt1");
    expect(apiCreateSession).toHaveBeenCalledWith("prompt2");
    expect(db.update).toHaveBeenCalledWith(expect.any(Object));
    expect(db.set).toHaveBeenCalledWith({ sessionIds: ["session1", "session2"] });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});
