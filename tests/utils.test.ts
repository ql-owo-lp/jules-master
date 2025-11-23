import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import { Session } from '@/lib/types';

describe('groupSessionsByTopic', () => {
  it('should group sessions by topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)' },
      { id: '2', prompt: '[TOPIC]: # (Test Topic 2)' },
      { id: '3', prompt: '[TOPIC]: # (Test Topic 1)' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(2);
    expect(remainingUnknown.length).toBe(0);
    expect(groupedSessions.get('Test Topic 1')?.length).toBe(2);
    expect(groupedSessions.get('Test Topic 2')?.length).toBe(1);
  });

  it('should handle sessions with no topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: 'No topic here' },
      { id: '2', prompt: '[TOPIC]: # (Test Topic 1)' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(1);
    expect(remainingUnknown.length).toBe(1);
  });

  it('should handle an empty array of sessions', () => {
    const sessions: Session[] = [];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(0);
  });

  it('should handle sessions with mixed formats', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)' },
      { id: '2', prompt: 'Another session with no topic' },
      { id: '3', prompt: '[TOPIC]: # (Test Topic 2)' },
      { id: '4', prompt: 'No topic here' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(2);
    expect(remainingUnknown.length).toBe(2);
  });
});

describe('createDynamicJobs', () => {
  it('should create dynamic jobs from grouped sessions', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('Test Job 1', [
      { id: '1', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
      { id: '2', createTime: '2023-01-02T12:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
    ]);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    expect(jobs[0].name).toBe('Test Job 1');
    expect(jobs[0].sessionIds.length).toBe(2);
    expect(jobs[0].createdAt).toBe('2023-01-02T12:00:00Z');
  });

  it('should handle sessions with no source context', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('Test Job 2', [{ id: '3', createTime: '2023-01-03T12:00:00Z' }]);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    expect(jobs[0].repo).toBe('unknown');
    expect(jobs[0].branch).toBe('unknown');
  });

  it('should use the latest session createTime for the job', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('Test Job 3', [
      { id: '4', createTime: '2023-01-05T12:00:00Z' },
      { id: '5', createTime: '2023-01-04T12:00:00Z' },
    ]);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    expect(jobs[0].createdAt).toBe('2023-01-05T12:00:00Z');
  });
});
