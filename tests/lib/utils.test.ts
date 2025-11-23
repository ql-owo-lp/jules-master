import { describe, it, expect } from 'vitest';
import { cn, groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import { Session } from '@/lib/types';

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('hello', 'world')).toBe('hello world');
      expect(cn('hello', { world: true })).toBe('hello world');
      expect(cn('hello', { world: false })).toBe('hello');
      expect(cn('hello', undefined, 'world')).toBe('hello world');
      expect(cn('text-red-500', 'bg-blue-500', 'p-4')).toBe('text-red-500 bg-blue-500 p-4');
    });

    it('should handle Tailwind CSS class conflicts', () => {
      expect(cn('p-4', 'p-2')).toBe('p-2');
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });
  });

  describe('groupSessionsByTopic', () => {
    it('should group sessions by topic and handle unknown sessions', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (Job A)' },
        { id: '2', prompt: '[TOPIC]: # (Job B)' },
        { id: '3', prompt: 'No topic here' },
        { id: '4', prompt: '[TOPIC]: # (Job A)' },
        { id: '5', prompt: '[TOPIC]: # (Job C)' },
        { id: '6', prompt: 'Another one without topic' },
      ];

      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);

      expect(groupedSessions.size).toBe(3);
      expect(groupedSessions.get('Job A')).toEqual([{ id: '1', prompt: '[TOPIC]: # (Job A)' }, { id: '4', prompt: '[TOPIC]: # (Job A)' }]);
      expect(groupedSessions.get('Job B')).toEqual([{ id: '2', prompt: '[TOPIC]: # (Job B)' }]);
      expect(groupedSessions.get('Job C')).toEqual([{ id: '5', prompt: '[TOPIC]: # (Job C)' }]);
      expect(remainingUnknown).toEqual([{ id: '3', prompt: 'No topic here' }, { id: '6', prompt: 'Another one without topic' }]);
    });
  });

  describe('createDynamicJobs', () => {
    it('should create dynamic jobs from grouped sessions', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Job A', [
        { id: '1', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
        { id: '2', createTime: '2023-01-01T13:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
      ]);
      groupedSessions.set('Job B', [
        { id: '3', createTime: '2023-01-02T10:00:00Z', sourceContext: { source: 'repo2', githubRepoContext: { startingBranch: 'dev' } } },
      ]);

      const jobs = createDynamicJobs(groupedSessions);

      expect(jobs.length).toBe(2);
      expect(jobs).toContainEqual({
        id: 'dynamic-Job A',
        name: 'Job A',
        sessionIds: ['1', '2'],
        createdAt: '2023-01-01T13:00:00Z',
        repo: 'repo1',
        branch: 'main',
      });
      expect(jobs).toContainEqual({
        id: 'dynamic-Job B',
        name: 'Job B',
        sessionIds: ['3'],
        createdAt: '2023-01-02T10:00:00Z',
        repo: 'repo2',
        branch: 'dev',
      });
    });
  });
});
