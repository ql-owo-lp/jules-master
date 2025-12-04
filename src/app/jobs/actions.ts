"use server";
import { generateTitle } from "@/ai/generate-title";
import { db } from "@/lib/db";
import { jobs, sessions } from "@/lib/db/schema";
import { createSession as apiCreateSession } from "@/lib/jules-api";
import { revalidatePath } from "next/cache";

export async function createJob(prompts: string[], jobName: string) {
  const name = jobName || (await generateTitle(prompts.join("\n")));

  const [job] = await db.insert(jobs).values({ name }).returning();

  const createdSessions = await Promise.all(
    prompts.map((prompt) =>
      apiCreateSession(prompt).then((session) => {
        if (session) {
          return db
            .insert(sessions)
            .values({ ...session, jobId: job.id })
            .returning();
        }
      })
    )
  );

  const sessionIds = createdSessions
    .flat()
    .filter(Boolean)
    .map((s) => s!.id);

  await db.update(jobs).set({ sessionIds }).where({ id: job.id });

  revalidatePath("/");
}
