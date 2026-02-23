import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs, deepEqual, hasDataChanged } from '../src/lib/utils';
import { Session } from '../src/lib/types';

describe('Utils', () => {
  describe('groupSessionsByTopic', () => {
    it('should group sessions by topic', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (Test Topic 1)\nSome details' } as any,
        { id: '2', prompt: '[TOPIC]: # (Test Topic 2)\nSome details' } as any,
        { id: '3', prompt: '[TOPIC]: # (Test Topic 1)\nSome other details' } as any,
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(2);
      expect(groupedSessions.get('Test Topic 1')?.length).toBe(2);
      expect(groupedSessions.get('Test Topic 2')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(0);
    });

    it('should handle sessions with no topic', () => {
      const sessions: Session[] = [
        { id: '1', prompt: 'No topic here' } as any,
        { id: '2', prompt: '[TOPIC]: # (Test Topic 1)\nSome details' } as any,
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(1);
      expect(groupedSessions.get('Test Topic 1')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(1);
      expect(remainingUnknown[0].id).toBe('1');
    });

    it('should handle empty sessions array', () => {
      const sessions: Session[] = [];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(0);
      expect(remainingUnknown.length).toBe(0);
    });

    it('should handle sessions with malformed topics', () => {
        const sessions: Session[] = [
          { id: '1', prompt: '[TOPIC]: # (Test Topic 1)\nSome details' } as any,
          { id: '2', prompt: '[TOPIC]: # Test Topic 2\nSome details' } as any,
        ];
        const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
        expect(groupedSessions.size).toBe(1);
        expect(groupedSessions.get('Test Topic 1')?.length).toBe(1);
        expect(remainingUnknown.length).toBe(1);
    });

    it('should trim whitespace from the topic name', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (  Test Topic 1  )\nSome details' } as any,
        { id: '2', prompt: '[TOPIC]: # (Test Topic 1)\nSome other details' } as any,
      ];
      const { groupedSessions } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(1);
      expect(groupedSessions.get('Test Topic 1')?.length).toBe(2);
    });

    it('should handle trailing whitespace after the topic', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (Test Topic 1) \nSome details' } as any,
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(1);
      expect(groupedSessions.get('Test Topic 1')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(0);
    });
  });

  describe('createDynamicJobs', () => {
    it('should create dynamic jobs from grouped sessions', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Test Job 1', [
        { id: '1', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'test/repo1', githubRepoContext: { startingBranch: 'main' } } } as any,
        { id: '2', createTime: '2023-01-01T13:00:00Z', sourceContext: { source: 'test/repo1', githubRepoContext: { startingBranch: 'main' } } } as any,
      ]);
      groupedSessions.set('Test Job 2', [
        { id: '3', createTime: '2023-01-02T12:00:00Z', sourceContext: { source: 'test/repo2', githubRepoContext: { startingBranch: 'develop' } } } as any,
      ]);

      const jobs = createDynamicJobs(groupedSessions);

      expect(jobs.length).toBe(2);
      expect(jobs[0].name).toBe('Test Job 1');
      expect(jobs[0].sessionIds.length).toBe(2);
      expect(jobs[0].repo).toBe('test/repo1');
      expect(jobs[0].branch).toBe('main');
      expect(jobs[0].createdAt).toBe('2023-01-01T13:00:00Z');

      expect(jobs[1].name).toBe('Test Job 2');
      expect(jobs[1].repo).toBe('test/repo2');
      expect(jobs[1].branch).toBe('develop');
    });

    it('should handle empty grouped sessions map', () => {
      const groupedSessions = new Map<string, Session[]>();
      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs.length).toBe(0);
    });

    it('should handle sessions with missing source context', () => {
        const groupedSessions = new Map<string, Session[]>();
        groupedSessions.set('Test Job 1', [
          { id: '1', createTime: '2023-01-01T12:00:00Z' } as any,
        ]);

        const jobs = createDynamicJobs(groupedSessions);

        expect(jobs.length).toBe(1);
        expect(jobs[0].name).toBe('Test Job 1');
        expect(jobs[0].repo).toBe('unknown');
        expect(jobs[0].branch).toBe('unknown');
      });
    it('should handle sessions with invalid createTime', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Test Job 1', [
        { id: '1', createTime: 'invalid-date' } as any,
        { id: '2', createTime: '2023-01-01T12:00:00Z' } as any,
      ]);
      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs[0].createdAt).toBe('2023-01-01T12:00:00Z');
    });

    it('should use the repo and branch from the latest session', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Test Job 1', [
        { id: '1', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'test/repo1', githubRepoContext: { startingBranch: 'main' } } } as any,
        { id: '2', createTime: '2023-01-02T12:00:00Z', sourceContext: { source: 'test/repo2', githubRepoContext: { startingBranch: 'develop' } } } as any,
      ]);

      const jobs = createDynamicJobs(groupedSessions);

      expect(jobs.length).toBe(1);
      expect(jobs[0].repo).toBe('test/repo2');
      expect(jobs[0].branch).toBe('develop');
    });
  });

  describe('deepEqual', () => {
    it('should return true for identical primitives', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual('test', 'test')).toBe(true);
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
    });

    it('should return false for different primitives', () => {
      expect(deepEqual(1, 2)).toBe(false);
      expect(deepEqual('test', 'rest')).toBe(false);
      expect(deepEqual(true, false)).toBe(false);
      expect(deepEqual(null, undefined)).toBe(false);
    });

    it('should return true for identical arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    });

    it('should return false for different arrays', () => {
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
      expect(deepEqual([1, 2], [1, 3])).toBe(false);
      expect(deepEqual([1, 2], ['1', '2'])).toBe(false);
    });

    it('should return true for identical objects', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(deepEqual({ a: 1, b: { c: 3 } }, { a: 1, b: { c: 3 } })).toBe(true);
    });

    it('should return false for different objects', () => {
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
      expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it('should handle Date objects', () => {
      const date1 = new Date('2023-01-01');
      const date2 = new Date('2023-01-01');
      const date3 = new Date('2023-01-02');
      expect(deepEqual(date1, date2)).toBe(true);
      expect(deepEqual(date1, date3)).toBe(false);
    });
  });

  describe('hasDataChanged', () => {
    it('should return false if arrays are identical', () => {
        const prev = [{ id: '1', val: 'a' }];
        const next = [{ id: '1', val: 'a' }];
        expect(hasDataChanged(prev, next)).toBe(false);
    });

    it('should return true if length differs', () => {
        const prev = [{ id: '1', val: 'a' }];
        const next = [{ id: '1', val: 'a' }, { id: '2', val: 'b' }];
        expect(hasDataChanged(prev, next)).toBe(true);
    });

    it('should return true if content differs', () => {
        const prev = [{ id: '1', val: 'a' }];
        const next = [{ id: '1', val: 'b' }];
        expect(hasDataChanged(prev, next)).toBe(true);
    });

    it('should return true if order differs', () => {
        const prev = [{ id: '1', val: 'a' }, { id: '2', val: 'b' }];
        const next = [{ id: '2', val: 'b' }, { id: '1', val: 'a' }];
        // It returns false because hasDataChanged handles reordering by creating a Map
        expect(hasDataChanged(prev, next)).toBe(false);
    });

    it('should use updateTime optimization if available', () => {
        const prev = [{ id: '1', updateTime: 't1', val: 'a' }];
        const next = [{ id: '1', updateTime: 't1', val: 'b' }]; // val changed but time didn't
        // Optimization assumes no change if time matches
        expect(hasDataChanged(prev, next)).toBe(false);
    });

    it('should return true if updateTime differs', () => {
        const prev = [{ id: '1', updateTime: 't1', val: 'a' }];
        const next = [{ id: '1', updateTime: 't2', val: 'a' }]; // val same but time diff
        expect(hasDataChanged(prev, next)).toBe(true);
    });

    it('should use deepEqual fallback if updateTime is missing', () => {
        const prev = [{ id: '1', val: 'a' }];
        const next = [{ id: '1', val: 'a' }];
        // Should use deepEqual and return false
        expect(hasDataChanged(prev, next)).toBe(false);
    });

    it('should return true with deepEqual if content changed', () => {
        const prev = [{ id: '1', val: 'a' }];
        const next = [{ id: '1', val: 'b' }];
        expect(hasDataChanged(prev, next)).toBe(true);
    });
  });
});
