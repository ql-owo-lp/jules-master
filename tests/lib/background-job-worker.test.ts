
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runBackgroundJobCheck } from '../../src/lib/background-job-worker';
import { db } from '../../src/lib/db';
import { jobs, sessions } from '../../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { upsertSession } from '../../src/lib/session-service';
import { listSources } from '../../src/app/sessions/actions';
import { createSession } from '../../src/app/sessions/new/actions';
import type { Session, Source } from '../../src/lib/types';

// Mock dependencies
vi.mock('../../src/app/sessions/actions', () => ({
  listSources: vi.fn(),
  listActivities: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn(),
}));

vi.mock('../../src/app/sessions/new/actions', () => ({
  createSession: vi.fn(),
}));

vi.mock('../../src/lib/session-service', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    upsertSession: vi.fn(),
  };
});

describe('BackgroundJobWorker - Crash Recovery', () => {
  const jobId = 'test-job-crash-recovery';
  const apiKey = 'test-api-key';

  beforeEach(async () => {
    // Set API Key
    process.env.JULES_API_KEY = apiKey;

    // Clean up DB - delete ALL jobs to prevent interference from other tests or previous runs
    await db.delete(jobs);

    // Mock Sources
    (listSources as any).mockResolvedValue([
      {
        id: 'source-1',
        name: 'sources/github/owner/repo',
        githubRepo: { owner: 'owner', repo: 'repo' }
      }
    ]);

    // Silence console logs
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.JULES_API_KEY;
  });

  it('should resume a PROCESSING job and create remaining sessions with correct arguments', async () => {
    // 1. Arrange: Insert a job in PROCESSING state with some sessions already created
    const existingSessionIds = ['session-1', 'session-2'];
    const totalSessions = 4;
    const repo = 'owner/repo';
    const branch = 'main';
    const prompt = 'Test Prompt';

    await db.insert(jobs).values({
      id: jobId,
      name: 'Test Recovery Job',
      sessionIds: existingSessionIds, // Already created 2
      createdAt: new Date().toISOString(),
      repo: repo,
      branch: branch,
      status: 'PROCESSING', // Simulating it was running when crashed
      sessionCount: totalSessions,
      prompt: prompt,
      background: true,
      autoApproval: false,
      automationMode: 'AUTO_CREATE_PR'
    });

    // Mock createSession to return new sessions
    let sessionCounter = 3;
    (createSession as any).mockImplementation(async () => {
      const id = `session-${sessionCounter++}`;
      return {
        id,
        name: `sessions/${id}`,
        title: `Session ${id}`,
        state: 'QUEUED',
      } as Session;
    });

    // 2. Act: Run the worker
    await runBackgroundJobCheck({ schedule: false });

    // 3. Assert
    // Verify createSession was called exactly 2 times (for session-3 and session-4)
    expect(createSession).toHaveBeenCalledTimes(2);

    // Verify correct arguments passed to createSession
    // Expected signature: createSession(sessionData: CreateSessionBody, apiKey?: string | null)
    // sessionData = { title, prompt, sourceContext, requirePlanApproval, automationMode }
    expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
            title: 'Test Recovery Job',
            prompt: prompt,
            sourceContext: expect.objectContaining({
                source: 'sources/github/owner/repo',
                githubRepoContext: expect.objectContaining({
                    startingBranch: branch
                })
            }),
            requirePlanApproval: false,
            automationMode: 'AUTO_CREATE_PR'
        }),
        apiKey,
        'default'
    );
  });
});
