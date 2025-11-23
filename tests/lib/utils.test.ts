
import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import type { Session } from '@/lib/types';

describe('groupSessionsByTopic', () => {
  it('should group sessions by topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)\nDetails', createTime: new Date().toISOString() },
      { id: '2', prompt: '[TOPIC]: # (Test Topic 2)\nDetails', createTime: new Date().toISOString() },
      { id: '3', prompt: '[TOPIC]: # (Test Topic 1)\nDetails', createTime: new Date().toISOString() },
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

  it('should handle an empty array of sessions', () => {
    const sessions: Session[] = [];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(0);
  });

  it('should handle mixed sessions', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)\nDetails', createTime: new Date().toISOString() },
      { id: '2', prompt: 'No topic here', createTime: new Date().toISOString() },
      { id: '3', prompt: '[TOPIC]: # (Test Topic 2)\nDetails', createTime: new Date().toISOString() },
      { id: '4', prompt: 'Another one without a topic', createTime: new Date().toISOString() },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('Test Topic 1')?.length).toBe(1);
    expect(groupedSessions.get('Test Topic 2')?.length).toBe(1);
    expect(remainingUnknown.length).toBe(2);
  });
});

describe('createDynamicJobs', () => {
  it('should create dynamic jobs from grouped sessions', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('Test Topic 1', [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)\nDetails', createTime: new Date().toISOString(), sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
      { id: '3', prompt: '[TOPIC]: # (Test Topic 1)\nDetails', createTime: new Date(Date.now() + 1000).toISOString(), sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
    ]);
    groupedSessions.set('Test Topic 2', [
      { id: '2', prompt: '[TOPIC]: # (Test Topic 2)\nDetails', createTime: new Date().toISOString(), sourceContext: { source: 'repo2', githubRepoContext: { startingBranch: 'dev' } } },
    ]);

    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(2);

    const job1 = jobs.find(job => job.name === 'Test Topic 1');
    expect(job1).toBeDefined();
    expect(job1?.sessionIds).toEqual(['1', '3']);
    expect(job1?.repo).toBe('repo1');
    expect(job1?.branch).toBe('main');

    const job2 = jobs.find(job => job.name === 'Test Topic 2');
    expect(job2).toBeDefined();
    expect(job2?.sessionIds).toEqual(['2']);
    expect(job2?.repo).toBe('repo2');
    expect(job2?.branch).toBe('dev');
  });

  it('should handle an empty map', () => {
    const groupedSessions = new Map<string, Session[]>();
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(0);
  });

  it('should handle sessions with missing source context', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('Test Topic 3', [
      { id: '4', prompt: '[TOPIC]: # (Test Topic 3)\nDetails', createTime: new Date().toISOString() },
    ]);

    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    const job = jobs[0];
    expect(job.repo).toBe('unknown');
    expect(job.branch).toBe('unknown');
  });
});
