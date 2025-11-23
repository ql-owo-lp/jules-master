import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import { Session, Job } from '@/lib/types';

describe('lib/utils', () => {
  describe('groupSessionsByTopic', () => {
    it('should group sessions by topic', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (topic1)\n' } as Session,
        { id: '2', prompt: '[TOPIC]: # (topic1)\n' } as Session,
        { id: '3', prompt: '[TOPIC]: # (topic2)\n' } as Session,
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(2);
      expect(groupedSessions.get('topic1')?.length).toBe(2);
      expect(groupedSessions.get('topic2')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(0);
    });

    it('should handle sessions without topics', () => {
      const sessions: Session[] = [
        { id: '1', prompt: 'no topic' } as Session,
        { id: '2', prompt: 'still no topic' } as Session,
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(0);
      expect(remainingUnknown.length).toBe(2);
    });

    it('should handle mixed sessions', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (topic1)\n' } as Session,
        { id: '2', prompt: 'no topic' } as Session,
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(1);
      expect(groupedSessions.get('topic1')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(1);
    });

    it('should handle sessions with empty prompts', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '' } as Session,
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(0);
      expect(remainingUnknown.length).toBe(1);
    });

    it('should handle sessions with no prompt property', () => {
      const sessions: Session[] = [
        { id: '1' } as Session,
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(0);
      expect(remainingUnknown.length).toBe(1);
    });

    it('should handle an empty session array', () => {
      const sessions: Session[] = [];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(0);
      expect(remainingUnknown.length).toBe(0);
    });
  });

  describe('createDynamicJobs', () => {
    it('should create dynamic jobs from grouped sessions', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('topic1', [
        { id: '1', createTime: '2023-01-01T00:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } } as Session,
        { id: '2', createTime: '2023-01-02T00:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } } as Session,
      ]);
      groupedSessions.set('topic2', [
        { id: '3', createTime: '2023-01-03T00:00:00Z', sourceContext: { source: 'repo2', githubRepoContext: { startingBranch: 'dev' } } } as Session,
      ]);

      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs.length).toBe(2);

      const job1 = jobs.find(j => j.name === 'topic1');
      expect(job1).toBeDefined();
      expect(job1?.sessionIds).toEqual(['1', '2']);
      expect(job1?.createdAt).toBe('2023-01-02T00:00:00Z');
      expect(job1?.repo).toBe('repo1');
      expect(job1?.branch).toBe('main');

      const job2 = jobs.find(j => j.name === 'topic2');
      expect(job2).toBeDefined();
      expect(job2?.sessionIds).toEqual(['3']);
    });

    it('should handle sessions with missing sourceContext', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('topic1', [
        { id: '1', createTime: '2023-01-01T00:00:00Z' } as Session,
      ]);
      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs.length).toBe(1);
      expect(jobs[0].repo).toBe('unknown');
      expect(jobs[0].branch).toBe('unknown');
    });

    it('should handle sessions with missing createTime', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('topic1', [
        { id: '1' } as Session,
      ]);
      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs.length).toBe(1);
      expect(jobs[0].createdAt).toBeDefined();
    });

    it('should handle an empty map', () => {
      const groupedSessions = new Map<string, Session[]>();
      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs.length).toBe(0);
    });
  });
});
