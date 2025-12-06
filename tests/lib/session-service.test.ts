
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
        state: 'COMPLETED',
      };
      expect(isPrMerged(sessionWithoutOutputs)).toBe(false);
    });

    it('should return false if a session has a pull request that is not merged', () => {
      const sessionWithOpenPr: Session = {
        id: 'session-3',
        name: 'sessions/session-3',
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
      const fromMock = vi.fn();
      mockedDb.select.mockReturnValue({ from: fromMock } as any);

      // Mock for the insert call in upsertSession
      mockedDb.insert.mockReturnValue({
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      } as any);

      fromMock.mockImplementation((table: any) => {
        if (table === settings) {
          return { limit: vi.fn().mockResolvedValue([mockSettings]) };
        }
        if (table === sessions) {
          return Promise.resolve([mergedSession]);
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
      // Due to the bug, this session WILL be fetched for an update.
      // The test will fail here until the bug is fixed.
      expect(mockedFetch).not.toHaveBeenCalledWith(
        `https://jules.googleapis.com/v1alpha/sessions/${mergedSession.id}`,
        expect.any(Object)
      );
    });
  });
});
