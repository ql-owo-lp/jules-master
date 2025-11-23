
import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import type { Session } from '@/lib/types';

describe('groupSessionsByTopic', () => {
  it('should group sessions by topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)', createTime: '2024-01-01T00:00:00Z' },
      { id: '2', prompt: '[TOPIC]: # (Test Topic 2)', createTime: '2024-01-02T00:00:00Z' },
      { id: '3', prompt: '[TOPIC]: # (Test Topic 1)', createTime: '2024-01-03T00:00:00Z' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('Test Topic 1')).toHaveLength(2);
    expect(groupedSessions.get('Test Topic 2')).toHaveLength(1);
    expect(remainingUnknown).toHaveLength(0);
  });

  it('should handle sessions with no topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: 'No topic here', createTime: '2024-01-01T00:00:00Z' },
      { id: '2', prompt: '[TOPIC]: # (Test Topic 1)', createTime: '2024-01-02T00:00:00Z' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(1);
    expect(groupedSessions.get('Test Topic 1')).toHaveLength(1);
    expect(remainingUnknown).toHaveLength(1);
  });
});

describe('createDynamicJobs', () => {
    it('should create dynamic jobs from grouped sessions', () => {
      const groupedSessions = new Map<string, Session[]>();
      groupedSessions.set('Test Job 1', [
        { id: '1', createTime: '2024-01-01T00:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
        { id: '2', createTime: '2024-01-02T00:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
      ]);
      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].name).toBe('Test Job 1');
      expect(jobs[0].sessionIds).toEqual(['1', '2']);
      expect(jobs[0].repo).toBe('repo1');
      expect(jobs[0].branch).toBe('main');
    });

    it('should handle empty grouped sessions', () => {
      const groupedSessions = new Map<string, Session[]>();
      const jobs = createDynamicJobs(groupedSessions);
      expect(jobs).toHaveLength(0);
    });
  });
