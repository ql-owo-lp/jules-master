
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { syncStaleSessions, isPrMerged } from '@/lib/session-service';
import { db, appDatabase } from '@/lib/db';
import { sessions, settings } from '@/lib/db/schema';
import * as fetchClient from '@/lib/fetch-client';
import type { Session } from '@/lib/types';

// Mock the db module
vi.mock('@/lib/db', () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
    },
    appDatabase: {
        profiles: {
            getActive: vi.fn()
        }
    }
}));

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
        title: 'Session 1',
        prompt: 'Prompt 1',
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

    it('should return true if a session has a merged pull request (case insensitive)', () => {
      const sessionWithMergedPr: Session = {
        id: 'session-1-lower',
        name: 'sessions/session-1-lower',
        title: 'Session 1 Lower',
        prompt: 'Prompt 1 Lower',
        state: 'COMPLETED',
        outputs: [
          {
            pullRequest: {
              status: 'merged' as any,
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
        title: 'Session 2',
        prompt: 'Prompt 2',
        state: 'COMPLETED',
      };
      expect(isPrMerged(sessionWithoutOutputs)).toBe(false);
    });

    it('should return false if a session has a pull request that is not merged', () => {
      const sessionWithOpenPr: Session = {
        id: 'session-3',
        name: 'sessions/session-3',
        title: 'Session 3',
        prompt: 'Prompt 3',
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
        prompt: 'Merged PR session prompt',
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

      // Mock Active Profile
      const mockProfile = { id: 'default', name: 'Default', isActive: true };
      // @ts-ignore
      appDatabase.profiles.getActive.mockResolvedValue(mockProfile);

      const mockedDb = vi.mocked(db);

      const selectMock = vi.fn();
      mockedDb.select.mockReturnValue({ from: selectMock } as any);

      // Mock for the insert call in upsertSession
      mockedDb.insert.mockReturnValue({
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockReturnValue([mockSettings]), // For getSettings if insert called
      } as any);

      selectMock.mockImplementation((table: any) => {
        if (table === settings) {
             // getSettings query: select().from(settings).where(...).limit(1)
             return {
                 where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([mockSettings])
                 }),
                 limit: vi.fn().mockResolvedValue([mockSettings])
             };
        }
        if (table === sessions) {
             // getCachedSessions query or within syncStaleSessions: select().from(sessions).where(...)
             return {
                 where: vi.fn().mockResolvedValue([mergedSession]),
                 orderBy: vi.fn().mockResolvedValue([mergedSession])
             }
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
