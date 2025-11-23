
import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import { Session, Job } from '@/lib/types';

describe('lib/utils', () => {
  describe('groupSessionsByTopic', () => {
    it('should group sessions by topic and separate unknown sessions', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (Job A)\nTest prompt', createTime: new Date().toISOString() },
        { id: '2', prompt: '[TOPIC]: # (Job B)\nTest prompt', createTime: new Date().toISOString() },
        { id: '3', prompt: 'No topic here', createTime: new Date().toISOString() },
        { id: '4', prompt: '[TOPIC]: # (Job A)\nAnother prompt', createTime: new Date().toISOString() },
      ];

      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);

      expect(groupedSessions.size).toBe(2);
      expect(groupedSessions.has('Job A')).toBe(true);
      expect(groupedSessions.get('Job A')).toHaveLength(2);
      expect(groupedSessions.get('Job B')).toHaveLength(1);

      expect(remainingUnknown).toHaveLength(1);
      expect(remainingUnknown[0].id).toBe('3');
    });

    it('should handle sessions with no prompt', () => {
      const sessions: Session[] = [
        { id: '1', prompt: undefined, createTime: new Date().toISOString() },
        { id: '2', prompt: '', createTime: new Date().toISOString() },
      ];

      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(0);
      expect(remainingUnknown).toHaveLength(2);
    });
  });

  describe('createDynamicJobs', () => {
    it('should create dynamic jobs from grouped sessions', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Job A', [
        { id: '1', prompt: '[TOPIC]: # (Job A)\nTest prompt', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'repo-a', githubRepoContext: { startingBranch: 'main' } } },
        { id: '4', prompt: '[TOPIC]: # (Job A)\nAnother prompt', createTime: '2023-01-01T13:00:00Z', sourceContext: { source: 'repo-a', githubRepoContext: { startingBranch: 'main' } } },
      ]);
      groupedSessions.set('Job B', [
        { id: '2', prompt: '[TOPIC]: # (Job B)\nTest prompt', createTime: '2023-01-01T14:00:00Z', sourceContext: { source: 'repo-b', githubRepoContext: { startingBranch: 'dev' } } },
      ]);

      const jobs = createDynamicJobs(groupedSessions);

      expect(jobs).toHaveLength(2);

      const jobA = jobs.find(j => j.name === 'Job A');
      expect(jobA).toBeDefined();
      expect(jobA?.id).toBe('dynamic-Job A');
      expect(jobA?.sessionIds).toEqual(['1', '4']);
      expect(jobA?.createdAt).toBe('2023-01-01T13:00:00Z');
      expect(jobA?.repo).toBe('repo-a');
      expect(jobA?.branch).toBe('main');

      const jobB = jobs.find(j => j.name === 'Job B');
      expect(jobB).toBeDefined();
      expect(jobB?.id).toBe('dynamic-Job B');
      expect(jobB?.sessionIds).toEqual(['2']);
      expect(jobB?.createdAt).toBe('2023-01-01T14:00:00Z');
      expect(jobB?.repo).toBe('repo-b');
      expect(jobB?.branch).toBe('dev');
    });

    it('should handle sessions with missing source context', () => {
        const groupedSessions = new Map<string, Session[]>();
        groupedSessions.set('Job C', [
            { id: '1', prompt: '[TOPIC]: # (Job C)\nTest prompt', createTime: '2023-01-01T12:00:00Z' },
        ]);

        const jobs = createDynamicJobs(groupedSessions);
        expect(jobs).toHaveLength(1);
        const jobC = jobs.find(j => j.name === 'Job C');
        expect(jobC).toBeDefined();
        expect(jobC?.repo).toBe('unknown');
        expect(jobC?.branch).toBe('unknown');

    });
  });
});
