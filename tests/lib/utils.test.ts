
import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import { Session } from '@/lib/types';

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
    groupedSessions.set('Test Topic 1', [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
      { id: '3', prompt: '[TOPIC]: # (Test Topic 1)', createTime: '2023-01-01T13:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
    ]);
    groupedSessions.set('Test Topic 2', [
      { id: '2', prompt: '[TOPIC]: # (Test Topic 2)', createTime: '2023-01-02T12:00:00Z', sourceContext: { source: 'repo2', githubRepoContext: { startingBranch: 'develop' } } },
    ]);

    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(2);

    const job1 = jobs.find(j => j.name === 'Test Topic 1');
    expect(job1).toBeDefined();
    expect(job1?.sessionIds).toEqual(['1', '3']);
    expect(job1?.createdAt).toBe('2023-01-01T13:00:00Z');
    expect(job1?.repo).toBe('repo1');
    expect(job1?.branch).toBe('main');

    const job2 = jobs.find(j => j.name === 'Test Topic 2');
    expect(job2).toBeDefined();
    expect(job2?.sessionIds).toEqual(['2']);
    expect(job2?.createdAt).toBe('2023-01-02T12:00:00Z');
    expect(job2?.repo).toBe('repo2');
    expect(job2?.branch).toBe('develop');
  });

  it('should handle an empty map of grouped sessions', () => {
    const groupedSessions = new Map<string, Session[]>();
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(0);
  });
});
