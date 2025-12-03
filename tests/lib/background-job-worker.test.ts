
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
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.JULES_API_KEY;
  });

  it('should resume a PROCESSING job and create remaining sessions', async () => {
    // 1. Arrange: Insert a job in PROCESSING state with some sessions already created
    const existingSessionIds = ['session-1', 'session-2'];
    const totalSessions = 4;

    await db.insert(jobs).values({
      id: jobId,
      name: 'Test Recovery Job',
      sessionIds: existingSessionIds, // Already created 2
      createdAt: new Date().toISOString(),
      repo: 'owner/repo',
      branch: 'main',
      status: 'PROCESSING', // Simulating it was running when crashed
      sessionCount: totalSessions,
      prompt: 'Test Prompt',
      background: true,
      autoApproval: false,
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

    // Verify DB state
    const updatedJob = await db.select().from(jobs).where(eq(jobs.id, jobId)).get();

    expect(updatedJob).toBeDefined();
    expect(updatedJob?.status).toBe('COMPLETED');
    expect(updatedJob?.sessionIds).toHaveLength(4);
    expect(updatedJob?.sessionIds).toEqual(['session-1', 'session-2', 'session-3', 'session-4']);

    // Verify persistence happened (upsertSession called)
    expect(upsertSession).toHaveBeenCalledTimes(2);
  });

  it('should handle jobs that were PENDING and start from scratch', async () => {
      // 1. Arrange
      const pendingJobId = 'test-job-pending';

      await db.insert(jobs).values({
        id: pendingJobId,
        name: 'Test Pending Job',
        sessionIds: [],
        createdAt: new Date().toISOString(),
        repo: 'owner/repo',
        branch: 'main',
        status: 'PENDING',
        sessionCount: 2,
        prompt: 'Test Prompt',
        background: true,
      });

      let sessionCounter = 1;
      (createSession as any).mockImplementation(async () => {
        const id = `new-session-${sessionCounter++}`;
        return { id, name: `sessions/${id}`, state: 'QUEUED' } as Session;
      });

      // 2. Act
      await runBackgroundJobCheck({ schedule: false });

      // 3. Assert
      const updatedJob = await db.select().from(jobs).where(eq(jobs.id, pendingJobId)).get();
      expect(updatedJob?.status).toBe('COMPLETED');
      expect(updatedJob?.sessionIds).toHaveLength(2);
  });
});
