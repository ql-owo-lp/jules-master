
'use server';

import { revalidatePath } from 'next/cache';
import { ai } from '@/ai/genkit';
import { db } from '@/lib/db';
import { jobs as jobsTable } from '@/lib/db/schema';
import { fetchWithRetry } from '@/lib/fetch-client';
import type { Job } from '@/lib/types';
import { desc } from 'drizzle-orm';

// Define the structure of the response from the Jules API when creating a session
interface CreateSessionResponse {
  session: {
    name: string;
    id: string;
  };
}

/**
 * Creates one or more jobs by sending prompts to the Jules API.
 * For each prompt, it creates a session, generates a title using an AI flow,
 * and then stores the job details in the database.
 *
 * @param {string[]} prompts - An array of prompts to create jobs for.
 * @returns {Promise<{jobs: Job[], error?: string}>} - A promise that resolves to the created jobs or an error.
 */
export async function createJobs(
  prompts: string[],
  apiKey?: string | null,
): Promise<{ jobs: Job[]; error?: string }> {
  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    const errorMsg = 'Jules API key is not configured.';
    console.error(errorMsg);
    return { jobs: [], error: errorMsg };
  }

  const createdJobs: Job[] = [];

  for (const prompt of prompts) {
    try {
      // Step 1: Create a session using the Jules API
      const response = await fetchWithRetry(
        'https://jules.googleapis.com/v1alpha/sessions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': effectiveApiKey,
          },
          body: JSON.stringify({ session: { prompt } }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to create session for prompt "${prompt}": ${response.status} ${response.statusText}`,
          errorText,
        );
        // Continue to the next prompt
        continue;
      }

      const { session } = (await response.json()) as CreateSessionResponse;

      // Step 2: Generate a title for the job using an AI flow
      const title = await ai.generateTitle(prompt);

      // Step 3: Store the new job in the database
      const newJob: Omit<Job, 'createdAt' | 'sessionIds'> = {
        id: session.id,
        name: title,
        prompt: prompt,
      };

      // Insert the new job into the database
      const [insertedJob] = await db
        .insert(jobsTable)
        .values({
          id: newJob.id,
          name: newJob.name,
          prompt: newJob.prompt,
        })
        .returning();

      createdJobs.push({
        ...insertedJob,
        sessionIds: [session.id],
      });
    } catch (error: any) {
      console.error(
        `An unexpected error occurred while processing prompt "${prompt}":`,
        error,
      );
      // It's possible the session was created but title generation or DB insertion failed.
      // For now, we'll just log and continue. A more robust implementation might handle cleanup.
    }
  }

  if (createdJobs.length > 0) {
    // Revalidate the page cache to show the new jobs
    revalidatePath('/');
  }

  return { jobs: createdJobs };
}

/**
 * Retrieves all jobs from the database, ordered by creation date.
 *
 * @returns {Promise<Job[]>} - A promise that resolves to a list of jobs.
 */
