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
    const job1 = jobs.find(j => j.name === 'topic1');
    expect(job1).toBeDefined();
    expect(job1?.repo).toBe('unknown');
    expect(job1?.branch).toBe('unknown');
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
    const job1 = jobs.find(j => j.name === 'topic1');
    expect(job1).toBeDefined();
    expect(job1?.branch).toBe('unknown');
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
    const job1 = jobs.find(j => j.name === 'topic1');
    expect(job1).toBeDefined();
    expect(job1?.createdAt).toBeDefined();
    expect(jobs[0].createdAt).toBeDefined();
  });

  it('should generate unique IDs for jobs with the same name', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (topic-A)\n' },
      { id: '2', prompt: '[TOPIC]: # (topic-B)\n' },
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs1 = createDynamicJobs(groupedSessions);
    const jobs2 = createDynamicJobs(groupedSessions);
    const jobA1 = jobs1.find(j => j.name === 'topic-A');
    const jobA2 = jobs2.find(j => j.name === 'topic-A');
    expect(jobA1?.id).not.toBe(jobA2?.id);
  });

  it('should handle empty session groups gracefully', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('empty-group', []);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs).toEqual([]);
  });

  it('should correctly slugify job names with special characters', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (a / b & c)\n' },
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    const job1 = jobs[0];
    expect(job1.name).toBe('a / b & c');
    expect(job1.id.startsWith('dynamic-a-b-c-')).toBe(true);
  });

  it('should generate unique IDs for each job across multiple calls', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('Test Job 1', [
      { id: '1', createTime: '2023-01-01T12:00:00Z' },
    ]);
    groupedSessions.set('Test Job 2', [
      { id: '2', createTime: '2023-01-02T12:00:00Z' },
    ]);

    const jobs1 = createDynamicJobs(groupedSessions);
    const jobs2 = createDynamicJobs(groupedSessions);

    const ids1 = new Set(jobs1.map(job => job.id));
    const ids2 = new Set(jobs2.map(job => job.id));

    expect(ids1.size).toBe(2);
    expect(ids2.size).toBe(2);

    for (const id of ids1) {
      expect(ids2.has(id)).toBe(false);
    }
  });
});
