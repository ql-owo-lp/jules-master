
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { syncStaleSessions, isPrMerged } from '@/lib/session-service';
import { db } from '@/lib/db';
import { sessions, settings } from '@/lib/db/schema';
import * as fetchClient from '@/lib/fetch-client';
import type { Session } from '@/lib/types';

// Mock the db module
vi.mock('@/lib/db');

// Mock fetchWithRetry from fetch-client
vi.mock('@/lib/fetch-client');

describe('Session Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('isPrMerged', () => {
    it('should return true if a session has a merged pull request', () => {
      const sessionWithMergedPr: Session = {
        id: 'session-1',
        name: 'sessions/session-1',
        title: 'Test Session',
        prompt: 'Test Prompt',
        state: 'COMPLETED',
        outputs: [
          {
            pullRequest: {
              status: 'MERGED',
              url: 'https://github.com/example/repo/pull/1',
              title: 'Test PR',
              description: 'This is a test pull request.',
            },
          },
        ],
      };
      expect(isPrMerged(sessionWithMergedPr)).toBe(true);
    });

    it('should return false if a session has no outputs', () => {
      const sessionWithoutOutputs: Session = {
        id: 'session-2',
        name: 'sessions/session-2',
        title: 'Test Session',
        prompt: 'Test Prompt',
        state: 'COMPLETED',
      };
      expect(isPrMerged(sessionWithoutOutputs)).toBe(false);
    });

    it('should return false if a session has a pull request that is not merged', () => {
      const sessionWithOpenPr: Session = {
        id: 'session-3',
        name: 'sessions/session-3',
        title: 'Test Session',
        prompt: 'Test Prompt',
        state: 'COMPLETED',
        outputs: [
          {
            pullRequest: {
              status: 'OPEN',
              url: 'https://github.com/example/repo/pull/2',
              title: 'Test PR 2',
              description: 'This is another test pull request.',
            },
          },
        ],
      };
      expect(isPrMerged(sessionWithOpenPr)).toBe(false);
    });
  });

  describe('syncStaleSessions', () => {
    it('should not update a completed session with a merged pull request', async () => {
      // Arrange
      const apiKey = 'test-api-key';
      const now = Date.now();
      const mergedSession = {
        id: 'session-merged',
        name: 'sessions/session-merged',
        title: 'Merged PR session',
        state: 'COMPLETED',
        createTime: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day old
        lastUpdated: now - (1801 * 1000), // older than sessionCacheCompletedNoPrInterval
        outputs: [
          {
            pullRequest: {
              url: 'https://github.com/test/repo/pull/1',
              title: 'Test PR',
              description: 'A test PR',
              status: 'MERGED',
            },
          },
        ],
      };

      const mockSettings = {
        sessionCacheMaxAgeDays: 3,
        sessionCacheInProgressInterval: 60,
        sessionCachePendingApprovalInterval: 300,
        sessionCacheCompletedNoPrInterval: 1800,
      };

      const mockedDb = vi.mocked(db);

      // Need to support chaining for db.select().from(settings).limit(1)
      // And db.select().from(sessions).orderBy(...)
      // My implementation of getCachedSessions uses orderBy.
      // My implementation of syncStaleSessions uses direct db.select().from(sessions).

      // Let's create a more robust chainable mock
      const mockChain = {
          from: vi.fn(),
          where: vi.fn(),
          limit: vi.fn(),
          orderBy: vi.fn(),
          get: vi.fn(),
      };

      // Allow chaining
      mockChain.from.mockReturnThis();
      mockChain.where.mockReturnThis();
      mockChain.limit.mockReturnThis();
      mockChain.orderBy.mockReturnThis();

      mockedDb.select.mockReturnValue(mockChain as any);

      // Mock for the insert call in upsertSession
      mockedDb.insert.mockReturnValue({
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      } as any);

      // Setup returns based on table
      mockChain.from.mockImplementation((table: any) => {
        if (table === settings) {
            // getSettings uses limit(1) which returns a promise resolving to array
            // It might also use where() if profileId is passed.
            // But we mocked 'limit' to return this, so we need to mock the promise resolution (then/await)
            // Wait, drizzle query objects are thenables.
            // We can make the chain object also a promise.
            const settingsPromise = Promise.resolve([mockSettings]);
            // If getSettings calls limit(1), it returns settingsPromise
            // If it awaits the chain, it gets settingsPromise result.
            // But the chain methods modify the query state.

            // Let's just mock the behavior of `await query` by making `then` available on the chain if we want.
            // BUT `getSettings` uses `await db.select()...` directly.
            // So `mockChain` needs to be awaitable.
            return {
                ...mockChain,
                then: (resolve: any) => resolve([mockSettings]),
                limit: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
            } as any;
        }
        if (table === sessions) {
            // syncStaleSessions does `await db.select().from(sessions)` (and optionally .where)
            // getCachedSessions does `await db.select().from(sessions).orderBy(...)` (and optionally .where)

            // We need to return an object that handles these chains and resolves to [mergedSession] or []
            return {
                ...mockChain,
                then: (resolve: any) => resolve([mergedSession]),
                orderBy: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
            } as any;
        }
        return Promise.resolve([]);
      });

      const mockedFetch = vi.mocked(fetchClient.fetchWithRetry);
      mockedFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...mergedSession, title: 'Updated Title' }),
      } as Response);

      // Act
      await syncStaleSessions(apiKey);

      // Assert
      expect(mockedFetch).not.toHaveBeenCalledWith(
        `https://jules.googleapis.com/v1alpha/sessions/${mergedSession.id}`,
        expect.any(Object)
      );
    });
  });
});
