
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createJobs } from '@/app/jobs/actions';
import { db } from '@/lib/db';
import { jobs } from '@/lib/db/schema';
import * as fetchClient from '@/lib/fetch-client';
import { ai } from '@/ai/genkit';

// Mock the dependencies
vi.mock('@/lib/fetch-client');
vi.mock('@/ai/genkit', () => ({
  ai: {
    generateTitle: vi.fn(),
  },
}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Job Actions', () => {
  beforeEach(async () => {
    // Clear the jobs table before each test
    await db.delete(jobs);
    // Reset the mocks
    vi.resetAllMocks();
  });

  it('should create a job successfully', async () => {
    // Arrange
    const prompts = ['test prompt'];
    const apiKey = 'test-api-key';
    const mockSession = { session: { id: 'session-123', name: 'sessions/session-123' } };
    const mockTitle = 'Test Title';

    const mockedFetch = vi.spyOn(fetchClient, 'fetchWithRetry').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSession),
    } as Response);

    (ai.generateTitle as vi.Mock).mockResolvedValueOnce(mockTitle);

    // Act
    const result = await createJobs(prompts, apiKey);

    // Assert
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].prompt).toBe(prompts[0]);
    expect(result.jobs[0].name).toBe(mockTitle);
    expect(result.error).toBeUndefined();

    // Verify that the job was inserted into the database
    const dbJobs = await db.select().from(jobs);
    expect(dbJobs).toHaveLength(1);
    expect(dbJobs[0].prompt).toBe(prompts[0]);

    // Verify mocks were called
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(ai.generateTitle).toHaveBeenCalledWith(prompts[0]);
  });

  it('should return an error if API key is not provided', async () => {
    // Arrange
    const prompts = ['test prompt'];

    // Act
    const result = await createJobs(prompts, null);

    // Assert
    expect(result.jobs).toHaveLength(0);
    expect(result.error).toBe('Jules API key is not configured.');
  });

  it('should handle API failure gracefully', async () => {
    // Arrange
    const prompts = ['test prompt'];
    const apiKey = 'test-api-key';

    vi.spyOn(fetchClient, 'fetchWithRetry').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('API Error'),
    } as Response);

    // Act
    const result = await createJobs(prompts, apiKey);

    // Assert
    expect(result.jobs).toHaveLength(0);
    expect(result.error).toBeUndefined(); // The error is logged, not returned

    // Verify that no job was inserted into the database
    const dbJobs = await db.select().from(jobs);
    expect(dbJobs).toHaveLength(0);
  });
});
