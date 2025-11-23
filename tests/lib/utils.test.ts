import { describe, it, expect } from 'vitest';
import { cn, groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import { Session, Job } from '@/lib/types';

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
    });

    it('should handle conflicting class names', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });

    it('should handle falsy values', () => {
      expect(cn('bg-red-500', null, undefined, false, '')).toBe('bg-red-500');
    });
  });

  describe('groupSessionsByTopic', () => {
    it('should group sessions by topic', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (Job A)\nDetails' },
        { id: '2', prompt: '[TOPIC]: # (Job B)\nDetails' },
        { id: '3', prompt: '[TOPIC]: # (Job A)\nDetails' },
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(2);
      expect(groupedSessions.get('Job A')?.length).toBe(2);
      expect(groupedSessions.get('Job B')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(0);
    });

    it('should handle sessions with no topic', () => {
      const sessions: Session[] = [
        { id: '1', prompt: 'No topic here' },
        { id: '2', prompt: '[TOPIC]: # (Job A)\nDetails' },
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(1);
      expect(groupedSessions.get('Job A')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(1);
      expect(remainingUnknown[0].id).toBe('1');
    });

    it('should handle sessions with empty or malformed prompts', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '' },
        { id: '2', prompt: '[TOPIC]: # (Job A)\nDetails' },
        { id: '3', prompt: null },
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(1);
      expect(groupedSessions.get('Job A')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(2);
    });
  });

  describe('createDynamicJobs', () => {
    it('should create dynamic jobs from grouped sessions', () => {
      const sessions: Session[] = [
        { id: '1', createTime: '2023-01-01T00:00:00Z', sourceContext: { source: 'repo-A', githubRepoContext: { startingBranch: 'main' } } },
        { id: '2', createTime: '2023-01-02T00:00:00Z', sourceContext: { source: 'repo-A', githubRepoContext: { startingBranch: 'main' } } },
      ];
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Job A', sessions);

      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs.length).toBe(1);
      const job = jobs[0];
      expect(job.name).toBe('Job A');
      expect(job.sessionIds).toEqual(['1', '2']);
      expect(job.createdAt).toBe('2023-01-02T00:00:00Z');
      expect(job.repo).toBe('repo-A');
      expect(job.branch).toBe('main');
    });

    it('should handle sessions without sourceContext', () => {
      const sessions: Session[] = [
        { id: '1', createTime: '2023-01-01T00:00:00Z' },
      ];
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Job B', sessions);

      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs.length).toBe(1);
      const job = jobs[0];
      expect(job.repo).toBe('unknown');
      expect(job.branch).toBe('unknown');
    });
  });
});
