import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import type { Session } from '@/lib/types';

describe('groupSessionsByTopic', () => {
  it('should return empty maps and arrays when given an empty array', () => {
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic([]);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(0);
  });

  it('should group sessions by topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\n' },
      { id: '2', prompt: '[TOPIC]: # (topic2)\n' },
      { id: '3', prompt: '[TOPIC]: # (topic1)\n' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('topic1')?.length).toBe(2);
    expect(groupedSessions.get('topic2')?.length).toBe(1);
    expect(remainingUnknown.length).toBe(0);
  });

  it('should handle sessions without a topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: 'no topic here' },
      { id: '2', prompt: 'another one' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(2);
  });

  it('should handle a mix of sessions with and without topics', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\n' },
      { id: '2', prompt: 'no topic here' },
      { id: '3', prompt: '[TOPIC]: # (topic2)\n' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('topic1')?.length).toBe(1);
    expect(groupedSessions.get('topic2')?.length).toBe(1);
    expect(remainingUnknown.length).toBe(1);
  });

  it('should handle sessions with null or undefined prompts', () => {
    const sessions: Session[] = [
      { id: '1', prompt: null },
      { id: '2', prompt: undefined },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(2);
  });

  it('should handle sessions with empty prompts', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(1);
  });

  it('should handle prompts that do not match the topic format', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: incorrect format' },
      { id: '2', prompt: 'TOPIC # (topic2)' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(2);
  });
});

describe('createDynamicJobs', () => {
  it('should return an empty array when given an empty map', () => {
    const jobs = createDynamicJobs(new Map());
    expect(jobs.length).toBe(0);
  });

  it('should create jobs from a map of grouped sessions', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\n', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
      { id: '2', prompt: '[TOPIC]: # (topic2)\n', createTime: '2023-01-02T12:00:00Z', sourceContext: { source: 'repo2', githubRepoContext: { startingBranch: 'develop' } } },
      { id: '3', prompt: '[TOPIC]: # (topic1)\n', createTime: '2023-01-03T12:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(2);
    const job1 = jobs.find(j => j.name === 'topic1');
    expect(job1).toBeDefined();
    expect(job1?.sessionIds).toEqual(['1', '3']);
    expect(job1?.repo).toBe('repo1');
    expect(job1?.branch).toBe('main');
    expect(job1?.createdAt).toBe('2023-01-03T12:00:00Z');
  });

  it('should handle sessions with missing sourceContext', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\n', createTime: '2023-01-01T12:00:00Z' },
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    expect(jobs[0].repo).toBe('unknown');
    expect(jobs[0].branch).toBe('unknown');
  });

  it('should handle sessions with missing githubRepoContext', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\n', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'repo1' } },
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    expect(jobs[0].repo).toBe('repo1');
    expect(jobs[0].branch).toBe('unknown');
  });

  it('should handle sessions with missing startingBranch', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\n', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: {} } },
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    expect(jobs[0].repo).toBe('repo1');
    expect(jobs[0].branch).toBe('unknown');
  });

  it('should handle sessions with missing createTime', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\n', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    expect(jobs[0].createdAt).toBeDefined();
  });
});
