
"use server";

import { revalidatePath } from "next/cache";
import { createJob as createJulesJob } from "@/lib/jules-api";
import { generateTitle } from "@/ai/generate-title";
import { db } from "@/lib/db";
import { jobs as jobsTable, sessions as sessionsTable } from "@/lib/db/schema";
import { nanoid } from "nanoid";

export async function createJob(prompts: string[]) {
    const julesApiKey = process.env.JULES_API_KEY;
    if (!julesApiKey) {
        throw new Error("Jules API key not configured");
    }

    const title = await generateTitle(prompts.join("\n"));

    const newJobId = nanoid();
    await db.insert(jobsTable).values({
        id: newJobId,
        name: title,
        status: "running",
    });

    for (const prompt of prompts) {
        const session = await createJulesJob(julesApiKey, prompt);
        await db.insert(sessionsTable).values({
            id: session.id,
            jobId: newJobId,
            state: session.state,
            prompt: prompt,
            prUrl: session.pr_url,
            createdAt: new Date(session.created_at),
            updatedAt: new Date(session.updated_at),
        });
    }

    revalidatePath("/");
}
