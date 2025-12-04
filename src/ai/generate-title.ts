
import { genkit } from "genkit";
import { google } from "@genkit-ai/google-genai";

export async function generateTitle(prompts: string): Promise<string> {
    const llm = google.geminiPro;
    const result = await genkit.generate({
        model: llm,
        prompt: `Generate a short, descriptive title for a batch job with the following prompts:\n\n${prompts}`,
    });
    return result.text();
}
