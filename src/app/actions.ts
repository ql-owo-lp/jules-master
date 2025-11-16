"use server";

import { generateJobTitle } from "@/ai/flows/generate-job-title";

export async function createTitleForJob(prompt: string): Promise<string> {
  if (!prompt.trim()) {
    return "Untitled Job";
  }

  try {
    const result = await generateJobTitle({ prompt });
    return result.jobTitle;
  } catch (error) {
    console.error("Error generating job title:", error);
    // Fallback to a shortened version of the prompt as title
    return prompt.length > 50 ? prompt.substring(0, 47) + "..." : prompt;
  }
}
