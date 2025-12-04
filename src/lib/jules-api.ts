
import { fetchWithRetry } from "./fetch-client";

export async function createJob(apiKey: string, prompt: string): Promise<{ id: string; state: string; pr_url: string; created_at: string; updated_at: string; }> {
    const response = await fetchWithRetry("https://api.jules.ai/v1/jobs", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
        throw new Error(`Failed to create job: ${response.statusText}`);
    }

    return response.json();
}
