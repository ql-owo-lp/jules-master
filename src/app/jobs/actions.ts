
"use server";

import { revalidatePath } from "next/cache";
import { createJob as createJobInDb } from "@/lib/jobs";

export async function createJob(
  name: string,
  repo: string,
  branch: string,
  prompts: string[]
): Promise<void> {
  await createJobInDb(name, repo, branch, prompts);
  revalidatePath("/");
}
