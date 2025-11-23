import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import { Session, Job } from '@/lib/types';

describe('groupSessionsByTopic', () => {
  it('should group sessions by topic and separate unknown sessions', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)\\nDetails...' },
      { id: '2', prompt: '[TOPIC]: # (Test Topic 2)\\nDetails...' },
      { id: '3', prompt: 'No topic here' },
      { id: '4', prompt: '[TOPIC]: # (Test Topic 1)\\nMore details...' },
    ];

    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);

    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('Test Topic 1')?.length).toBe(2);
    expect(groupedSessions.get('Test Topic 2')?.length).toBe(1);
    expect(remainingUnknown.length).toBe(1);
    expect(remainingUnknown[0].id).toBe('3');
  });

  it('should handle sessions with no prompt', () => {
    const sessions: Session[] = [
      { id: '1', prompt: undefined },
      { id: '2', prompt: '[TOPIC]: # (Test Topic 1)\\nDetails...' },
    ];

    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);

    expect(groupedSessions.size).toBe(1);
    expect(groupedSessions.get('Test Topic 1')?.length).toBe(1);
    expect(remainingUnknown.length).toBe(1);
    expect(remainingUnknown[0].id).toBe('1');
  });

  it('should handle an empty array of sessions', () => {
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic([]);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(0);
  });
});

describe('createDynamicJobs', () => {
  it('should create dynamic jobs from grouped sessions', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('Test Job 1', [
      {
        id: '1',
        createTime: '2023-01-01T12:00:00Z',
        sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } },
      },
      {
        id: '2',
        createTime: '2023-01-01T13:00:00Z',
        sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } },
      },
    ]);

    const jobs = createDynamicJobs(groupedSessions);

    expect(jobs.length).toBe(1);
    const job = jobs[0];
    expect(job.name).toBe('Test Job 1');
    expect(job.sessionIds).toEqual(['1', '2']);
    expect(job.createdAt).toBe('2023-01-01T13:00:00Z');
    expect(job.repo).toBe('repo1');
    expect(job.branch).toBe('main');
  });

  it('should handle sessions with missing source context', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('Test Job 2', [{ id: '3', createTime: '2023-01-02T10:00:00Z' }]);

    const jobs = createDynamicJobs(groupedSessions);

    expect(jobs.length).toBe(1);
    const job = jobs[0];
    expect(job.repo).toBe('unknown');
    expect(job.branch).toBe('unknown');
  });

  it('should handle an empty map of grouped sessions', () => {
    const jobs = createDynamicJobs(new Map());
    expect(jobs.length).toBe(0);
  });
});
