'use server';

/**
 * @fileOverview A flow to generate a job title based on the user's prompt.
 *
 * - generateJobTitle - A function that handles the job title generation process.
 * - GenerateJobTitleInput - The input type for the generateJobTitle function.
 * - GenerateJobTitleOutput - The return type for the generateJobTitle function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateJobTitleInputSchema = z.object({
  prompt: z
    .string()
    .describe('The prompt provided by the user to create a job.'),
});
export type GenerateJobTitleInput = z.infer<typeof GenerateJobTitleInputSchema>;

const GenerateJobTitleOutputSchema = z.object({
  jobTitle: z
    .string()
    .describe('A short, descriptive title summarizing the job.'),
});
export type GenerateJobTitleOutput = z.infer<typeof GenerateJobTitleOutputSchema>;

export async function generateJobTitle(
  input: GenerateJobTitleInput
): Promise<GenerateJobTitleOutput> {
  return generateJobTitleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateJobTitlePrompt',
  input: {schema: GenerateJobTitleInputSchema},
  output: {schema: GenerateJobTitleOutputSchema},
  prompt: `You are an expert at summarizing job prompts into concise and descriptive titles.

  Based on the following job prompt, generate a title that accurately reflects the job's purpose:
  \"{{{prompt}}}\"`,
});

const generateJobTitleFlow = ai.defineFlow(
  {
    name: 'generateJobTitleFlow',
    inputSchema: GenerateJobTitleInputSchema,
    outputSchema: GenerateJobTitleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
