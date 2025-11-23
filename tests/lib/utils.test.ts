import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '../../src/lib/utils';
import { Session } from '../../src/lib/types';

describe('lib/utils', () => {
  describe('groupSessionsByTopic', () => {
    it('should group sessions by topic', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (Test Topic 1)', createTime: new Date().toISOString() },
        { id: '2', prompt: '[TOPIC]: # (Test Topic 1)', createTime: new Date().toISOString() },
        { id: '3', prompt: '[TOPIC]: # (Test Topic 2)', createTime: new Date().toISOString() },
      ];

      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);

      expect(groupedSessions.size).toBe(2);
      expect(groupedSessions.get('Test Topic 1')?.length).toBe(2);
      expect(groupedSessions.get('Test Topic 2')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(0);
    });

    it('should handle sessions without a topic', () => {
      const sessions: Session[] = [
        { id: '1', prompt: 'No topic here', createTime: new Date().toISOString() },
        { id: '2', prompt: 'Another one without a topic', createTime: new Date().toISOString() },
      ];

      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);

      expect(groupedSessions.size).toBe(0);
      expect(remainingUnknown.length).toBe(2);
    });

    it('should handle a mix of sessions with and without topics', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (Test Topic 1)', createTime: new Date().toISOString() },
        { id: '2', prompt: 'No topic here', createTime: new Date().toISOString() },
        { id: '3', prompt: '[TOPIC]: # (Test Topic 2)', createTime: new Date().toISOString() },
      ];

      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);

      expect(groupedSessions.size).toBe(2);
      expect(groupedSessions.get('Test Topic 1')?.length).toBe(1);
      expect(groupedSessions.get('Test Topic 2')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(1);
    });

    it('should handle an empty array of sessions', () => {
      const sessions: Session[] = [];

      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);

      expect(groupedSessions.size).toBe(0);
      expect(remainingUnknown.length).toBe(0);
    });
  });

  describe('createDynamicJobs', () => {
    it('should create dynamic jobs from grouped sessions', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Test Job 1', [
        { id: '1', createTime: new Date().toISOString(), sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
        { id: '2', createTime: new Date().toISOString(), sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
      ]);
      groupedSessions.set('Test Job 2', [
        { id: '3', createTime: new Date().toISOString(), sourceContext: { source: 'repo2', githubRepoContext: { startingBranch: 'dev' } } },
      ]);

      const jobs = createDynamicJobs(groupedSessions);

      expect(jobs.length).toBe(2);
      expect(jobs[0].name).toBe('Test Job 1');
      expect(jobs[0].sessionIds.length).toBe(2);
      expect(jobs[0].repo).toBe('repo1');
      expect(jobs[0].branch).toBe('main');
      expect(jobs[1].name).toBe('Test Job 2');
    });

    it('should handle an empty map of grouped sessions', () => {
      const groupedSessions = new Map<string, Session[]>();
      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs.length).toBe(0);
    });

    it('should handle sessions with missing source context', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Test Job 1', [
        { id: '1', createTime: new Date().toISOString() },
      ]);

      const jobs = createDynamicJobs(groupedSessions);

      expect(jobs.length).toBe(1);
      expect(jobs[0].repo).toBe('unknown');
      expect(jobs[0].branch).toBe('unknown');
    });
  });
});
