
"use server";

import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { randomUUID } from "crypto";

// This is a placeholder for the actual API call to create a session.
// Replace this with your actual API call.
async function createJulesSession(prompt: string): Promise<{ id: string }> {
  console.log(`Creating Jules session with prompt: ${prompt}`);
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { id: `session-${randomUUID()}` };
}

export async function createJob(
  name: string,
  repo: string,
  branch: string,
  prompts: string[]
): Promise<void> {
  const job = {
    id: `job-${randomUUID()}`,
    name,
    repo,
    branch,
    createdAt: new Date().toISOString(),
    sessionIds: [],
    status: "PENDING",
  };

  await db.insert(jobs).values(job);

  // This is a simplified version of the job creation process.
  // In a real application, you would likely have a background worker
  // to process the job and create the sessions.
  const sessionIds = await Promise.all(
    prompts.map(prompt => createJulesSession(prompt).then(session => session.id))
  );

  await db
    .update(jobs)
    .set({ sessionIds, status: "COMPLETED" })
    .where("id", job.id);
}
