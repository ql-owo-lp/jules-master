import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '../src/lib/utils';
import { Session } from '../src/lib/types';

describe('Utils', () => {
  describe('groupSessionsByTopic', () => {
    it('should group sessions by topic', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (Test Topic 1)\nSome details' },
        { id: '2', prompt: '[TOPIC]: # (Test Topic 2)\nSome details' },
        { id: '3', prompt: '[TOPIC]: # (Test Topic 1)\nSome other details' },
      ];
      const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(2);
      expect(groupedSessions.get('Test Topic 1')?.length).toBe(2);
      expect(groupedSessions.get('Test Topic 2')?.length).toBe(1);
      expect(remainingUnknown.length).toBe(0);
    });

    it('should handle sessions with no topic', () => {
      const sessions: Session[] = [
        { id: '1', prompt: 'No topic here' },
        { id: '2', prompt: '[TOPIC]: # (Test Topic 1)\nSome details' },
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
          { id: '1', prompt: '[TOPIC]: # (Test Topic 1)\nSome details' },
          { id: '2', prompt: '[TOPIC]: # Test Topic 2\nSome details' },
        ];
        const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
        expect(groupedSessions.size).toBe(1);
        expect(groupedSessions.get('Test Topic 1')?.length).toBe(1);
        expect(remainingUnknown.length).toBe(1);
    });

    it('should trim whitespace from the topic name', () => {
      const sessions: Session[] = [
        { id: '1', prompt: '[TOPIC]: # (  Test Topic 1  )\nSome details' },
        { id: '2', prompt: '[TOPIC]: # (Test Topic 1)\nSome other details' },
      ];
      const { groupedSessions } = groupSessionsByTopic(sessions);
      expect(groupedSessions.size).toBe(1);
      expect(groupedSessions.get('Test Topic 1')?.length).toBe(2);
    });
  });

  describe('createDynamicJobs', () => {
    it('should create dynamic jobs from grouped sessions', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Test Job 1', [
        { id: '1', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'test/repo1', githubRepoContext: { startingBranch: 'main' } } },
        { id: '2', createTime: '2023-01-01T13:00:00Z', sourceContext: { source: 'test/repo1', githubRepoContext: { startingBranch: 'main' } } },
      ]);
      groupedSessions.set('Test Job 2', [
        { id: '3', createTime: '2023-01-02T12:00:00Z', sourceContext: { source: 'test/repo2', githubRepoContext: { startingBranch: 'develop' } } },
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
          { id: '1', createTime: '2023-01-01T12:00:00Z' },
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
        { id: '1', createTime: 'invalid-date' },
        { id: '2', createTime: '2023-01-01T12:00:00Z' },
      ]);
      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs[0].createdAt).toBe('2023-01-01T12:00:00Z');
    });

    it('should use the repo and branch from the latest session', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Test Job 1', [
        { id: '1', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'test/repo1', githubRepoContext: { startingBranch: 'main' } } },
        { id: '2', createTime: '2023-01-02T12:00:00Z', sourceContext: { source: 'test/repo2', githubRepoContext: { startingBranch: 'develop' } } },
      ]);

      const jobs = createDynamicJobs(groupedSessions);

      expect(jobs.length).toBe(1);
      expect(jobs[0].repo).toBe('test/repo2');
      expect(jobs[0].branch).toBe('develop');
    });
  });
});
