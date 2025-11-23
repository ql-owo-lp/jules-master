import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '../src/lib/utils';
import { Session } from '../src/lib/types';

describe('groupSessionsByTopic', () => {
  it('should group sessions by topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)' },
      { id: '2', prompt: '[TOPIC]: # (Test Topic 2)' },
      { id: '3', prompt: '[TOPIC]: # (Test Topic 1)' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('Test Topic 1')?.length).toBe(2);
    expect(groupedSessions.get('Test Topic 2')?.length).toBe(1);
    expect(remainingUnknown.length).toBe(0);
  });

  it('should handle sessions without a topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: 'No topic here' },
      { id: '2', prompt: 'Another one' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(2);
  });

  it('should handle a mix of sessions with and without topics', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)' },
      { id: '2', prompt: 'No topic here' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(1);
    expect(groupedSessions.get('Test Topic 1')?.length).toBe(1);
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
  it('should create jobs from grouped sessions', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('Test Topic 1', [
      { id: '1', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'github', githubRepoContext: { startingBranch: 'main' } } },
    ]);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    expect(jobs[0].name).toBe('Test Topic 1');
    expect(jobs[0].repo).toBe('github');
  });

  it('should handle an empty map of grouped sessions', () => {
    const groupedSessions = new Map<string, Session[]>();
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(0);
  });
});
