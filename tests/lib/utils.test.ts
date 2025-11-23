import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import type { Session, Job } from '@/lib/types';

describe('groupSessionsByTopic', () => {
  it('should group sessions by topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\\n...', createTime: '2023-01-01T00:00:00Z' },
      { id: '2', prompt: '[TOPIC]: # (topic1)\\n...', createTime: '2023-01-01T01:00:00Z' },
      { id: '3', prompt: '[TOPIC]: # (topic2)\\n...', createTime: '2023-01-01T02:00:00Z' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('topic1')?.length).toBe(2);
    expect(groupedSessions.get('topic2')?.length).toBe(1);
    expect(remainingUnknown.length).toBe(0);
  });

  it('should handle sessions with no topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: 'no topic here', createTime: '2023-01-01T00:00:00Z' },
      { id: '2', prompt: '[TOPIC]: # (topic1)\\n...', createTime: '2023-01-01T01:00:00Z' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(1);
    expect(groupedSessions.get('topic1')?.length).toBe(1);
    expect(remainingUnknown.length).toBe(1);
    expect(remainingUnknown[0].id).toBe('1');
  });

  it('should handle empty sessions array', () => {
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic([]);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(0);
  });

  it('should handle sessions with undefined or empty prompts', () => {
    const sessions: Session[] = [
      { id: '1', prompt: undefined, createTime: '2023-01-01T00:00:00Z' },
      { id: '2', prompt: '', createTime: '2023-01-01T01:00:00Z' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(2);
  });
});

describe('createDynamicJobs', () => {
    it('should create jobs from grouped sessions', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('topic1', [
        { id: '1', prompt: '[TOPIC]: # (topic1)', createTime: '2023-01-01T00:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
        { id: '2', prompt: '[TOPIC]: # (topic1)', createTime: '2023-01-01T01:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
      ]);
      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs.length).toBe(1);
      expect(jobs[0].name).toBe('topic1');
      expect(jobs[0].sessionIds).toEqual(['1', '2']);
      expect(jobs[0].repo).toBe('repo1');
      expect(jobs[0].branch).toBe('main');
      expect(jobs[0].createdAt).toBe('2023-01-01T01:00:00Z');
    });

    it('should handle empty grouped sessions map', () => {
      const jobs = createDynamicJobs(new Map());
      expect(jobs.length).toBe(0);
    });

    it('should handle sessions with missing source context', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('topic1', [
        { id: '1', prompt: '[TOPIC]: # (topic1)', createTime: '2023-01-01T00:00:00Z' },
      ]);
      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs[0].repo).toBe('unknown');
      expect(jobs[0].branch).toBe('unknown');
    });

    it('should use the latest session createTime as the job createdAt', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('topic1', [
        { id: '1', prompt: '[TOPIC]: # (topic1)', createTime: '2023-01-01T02:00:00Z' },
        { id: '2', prompt: '[TOPIC]: # (topic1)', createTime: '2023-01-01T00:00:00Z' },
        { id: '3', prompt: '[TOPIC]: # (topic1)', createTime: '2023-01-01T01:00:00Z' },
      ]);
      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs[0].createdAt).toBe('2023-01-01T02:00:00Z');
    });
});
