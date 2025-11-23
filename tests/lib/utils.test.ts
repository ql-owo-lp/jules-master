import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '../../src/lib/utils';
import { Session, Job } from '../../src/lib/types';

describe('lib/utils', () => {
  describe('groupSessionsByTopic', () => {
    it('should return empty maps and arrays when given an empty array', () => {
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic([]);
      expect(groupedSessions.size).toBe(0);
      expect(remainingUnknown.length).toBe(0);
    });

    it('should group sessions by topic', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (Topic A)', createTime: new Date().toISOString() },
        { id: '2', prompt: '[TOPIC]: # (Topic B)', createTime: new Date().toISOString() },
        { id: '3', prompt: '[TOPIC]: # (Topic A)', createTime: new Date().toISOString() },
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(2);
      expect(groupedSessions.get('Topic A')?.length).toBe(2);
      expect(groupedSessions.get('Topic B')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(0);
    });

    it('should put sessions without a topic into remainingUnknown', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (Topic A)', createTime: new Date().toISOString() },
        { id: '2', prompt: 'No topic here', createTime: new Date().toISOString() },
        { id: '3', prompt: undefined, createTime: new Date().toISOString() },
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(1);
      expect(groupedSessions.get('Topic A')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(2);
    });
  });

  describe('createDynamicJobs', () => {
    it('should return an empty array when given an empty map', () => {
      const jobs = createDynamicJobs(new Map());
      expect(jobs.length).toBe(0);
    });

    it('should create dynamic jobs from grouped sessions', () => {
      const session1 = { id: '1', createTime: new Date(2023, 1, 1).toISOString(), sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } };
      const session2 = { id: '2', createTime: new Date(2023, 1, 2).toISOString(), sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } };
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Topic A', [session1, session2]);

      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs.length).toBe(1);
      const job = jobs[0];
      expect(job.name).toBe('Topic A');
      expect(job.sessionIds).toEqual(['1', '2']);
      expect(job.repo).toBe('repo1');
      expect(job.branch).toBe('main');
      expect(job.createdAt).toBe(session2.createTime);
    });

    it('should handle sessions with missing sourceContext', () => {
        const session1 = { id: '1', createTime: new Date().toISOString() };
        const groupedSessions = new Map<string, Session[]>();
        groupedSessions.set('Topic A', [session1]);

        const jobs = createDynamicJobs(groupedSessions);
        expect(jobs.length).toBe(1);
        const job = jobs[0];
        expect(job.repo).toBe('unknown');
        expect(job.branch).toBe('unknown');
    });

    it('should handle sessions with missing createTime', () => {
        const session1 = { id: '1', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } };
        const groupedSessions = new Map<string, Session[]>();
        groupedSessions.set('Topic A', [session1]);

        const jobs = createDynamicJobs(groupedSessions);
        expect(jobs.length).toBe(1);
        const job = jobs[0];
        expect(job.createdAt).toBeDefined();
    });
  });
});
