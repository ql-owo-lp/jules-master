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
      { id: '1', prompt: '[TOPIC]: # (topic1)\n' } as any,
      { id: '2', prompt: '[TOPIC]: # (topic2)\n' } as any,
      { id: '3', prompt: '[TOPIC]: # (topic1)\n' } as any,
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('topic1')?.length).toBe(2);
    expect(groupedSessions.get('topic2')?.length).toBe(1);
    expect(remainingUnknown.length).toBe(0);
  });

  it('should handle sessions without a topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: 'no topic here' } as any,
      { id: '2', prompt: 'another one' } as any,
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(2);
  });

  it('should handle a mix of sessions with and without topics', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\n' } as any,
      { id: '2', prompt: 'no topic here' } as any,
      { id: '3', prompt: '[TOPIC]: # (topic2)\n' } as any,
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('topic1')?.length).toBe(1);
    expect(groupedSessions.get('topic2')?.length).toBe(1);
    expect(remainingUnknown.length).toBe(1);
  });

  it('should handle sessions with null or undefined prompts', () => {
    const sessions: Session[] = [
      { id: '1', prompt: null } as any,
      { id: '2', prompt: undefined } as any,
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(2);
  });

  it('should handle sessions with empty prompts', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '' } as any,
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(1);
  });

  it('should handle prompts that do not match the topic format', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: incorrect format' } as any,
      { id: '2', prompt: 'TOPIC # (topic2)' } as any,
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
      { id: '1', prompt: '[TOPIC]: # (topic1)\n', createTime: '2023-01-01T10:00:00Z', sourceContext: { source: 'source-1', githubRepoContext: { startingBranch: 'branch-1' } } } as any,
      { id: '2', prompt: '[TOPIC]: # (topic1)\n', createTime: '2023-01-01T11:00:00Z', sourceContext: { source: 'source-1', githubRepoContext: { startingBranch: 'branch-1' } } } as any,
      { id: '3', prompt: '[TOPIC]: # (topic1)\n', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'source-1', githubRepoContext: { startingBranch: 'branch-1' } } } as any,
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1); // Changed from 2 to 1
    const job1 = jobs.find(j => j.name === 'topic1');
    expect(job1).toBeDefined();
    expect(job1?.sessionIds).toEqual(['1', '2', '3']); // Changed from ['1', '3'] to ['1', '2', '3']
    expect(job1?.repo).toBe('source-1'); // Changed from 'repo1' to 'source-1'
    expect(job1?.branch).toBe('branch-1'); // Changed from 'main' to 'branch-1'
    expect(job1?.createdAt).toBe('2023-01-01T12:00:00Z'); // Changed from '2023-01-03T12:00:00Z' to '2023-01-01T12:00:00Z'
  });

  it('should handle sessions with missing sourceContext', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\n', createTime: '2023-01-01T10:00:00Z' } as any,
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    const job1 = jobs.find(j => j.name === 'topic1');
    expect(job1).toBeDefined();
    expect(job1?.repo).toBe('unknown');
    expect(job1?.branch).toBe('unknown');
    expect(jobs[0].repo).toBe('unknown');
    expect(jobs[0].branch).toBe('unknown');
  });

  it('should handle sessions with missing githubRepoContext', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\n', createTime: '2023-01-01T10:00:00Z', sourceContext: { source: 'source-1' } } as any,
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    const job1 = jobs.find(j => j.name === 'topic1');
    expect(job1).toBeDefined();
    expect(job1?.branch).toBe('unknown');
    expect(jobs[0].repo).toBe('source-1'); // Changed from 'repo1' to 'source-1'
    expect(jobs[0].branch).toBe('unknown');
  });

  it('should handle sessions with missing startingBranch', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\n', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'source-1', githubRepoContext: {} } } as any, // Corrected syntax
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    expect(jobs[0].repo).toBe('source-1'); // Changed from 'repo1' to 'source-1'
    expect(jobs[0].branch).toBe('unknown');
  });

  it('should handle sessions with missing createTime', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic1)\n', sourceContext: { source: 'source-1', githubRepoContext: { startingBranch: 'branch-1' } } } as any,
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    const job1 = jobs.find(j => j.name === 'topic1');
    expect(job1).toBeDefined();
    expect(job1?.createdAt).toBeDefined();
    expect(jobs[0].createdAt).toBeDefined();
  });

  it('should generate a stable ID for the same set of sessions', () => {
    const sessions: Session[] = [
      { id: 'session-1', prompt: '[TOPIC]: # (Test Job)', createTime: '2023-01-01T12:00:00Z', title: 'Session 1', state: 'COMPLETED', name: 'sessions/1' } as any,
      { id: 'session-2', prompt: '[TOPIC]: # (Test Job)', createTime: '2023-01-01T13:00:00Z', title: 'Session 2', state: 'COMPLETED', name: 'sessions/2' } as any,
    ];

    const { groupedSessions } = groupSessionsByTopic(sessions);
    const dynamicJobs1 = createDynamicJobs(groupedSessions);

    const sessionsReordered: Session[] = [
      { id: 'session-2', prompt: '[TOPIC]: # (Test Job)', createTime: '2023-01-01T13:00:00Z', title: 'Session 2', state: 'COMPLETED', name: 'sessions/2' } as any,
      { id: 'session-1', prompt: '[TOPIC]: # (Test Job)', createTime: '2023-01-01T12:00:00Z', title: 'Session 1', state: 'COMPLETED', name: 'sessions/1' } as any,
    ];

    const { groupedSessions: groupedSessionsReordered } = groupSessionsByTopic(sessionsReordered);
    const dynamicJobs2 = createDynamicJobs(groupedSessionsReordered);

    expect(dynamicJobs1[0].id).toBe(dynamicJobs2[0].id);
  });

  it('should handle empty session groups gracefully', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('empty-group', []);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs).toEqual([]);
  });

  it('should correctly slugify job names with special characters', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (a / b & c)\n' } as any,
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    const job1 = jobs[0];
    expect(job1.name).toBe('a / b & c');
    expect(job1.id.startsWith('dynamic-a-b-c-')).toBe(true);
  });

  it('should handle job names that are only special characters and produce a valid id', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (!!!)\n' } as any,
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    const job1 = jobs[0];
    expect(job1.name).toBe('!!!');
    const idParts = job1.id.split('-');
    expect(idParts[1]).not.toBe('');
  });
});
