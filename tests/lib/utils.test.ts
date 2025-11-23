import { describe, it, expect } from 'vitest';
import { cn, groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import { Session } from '@/lib/types';

describe('cn', () => {
  it('should merge class names correctly', () => {
    expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
  });

  it('should handle conditional classes', () => {
    expect(cn('bg-red-500', { 'text-white': true, 'font-bold': false })).toBe('bg-red-500 text-white');
  });

  it('should override conflicting classes', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });
});

describe('groupSessionsByTopic', () => {
  it('should group sessions by topic and separate remaining unknown', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)' } as Session,
      { id: '2', prompt: 'No topic here' } as Session,
      { id: '3', prompt: '[TOPIC]: # (Test Topic 2)' } as Session,
      { id: '4', prompt: '[TOPIC]: # (Test Topic 1)' } as Session,
    ];

    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);

    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('Test Topic 1')).toHaveLength(2);
    expect(groupedSessions.get('Test Topic 2')).toHaveLength(1);
    expect(remainingUnknown).toHaveLength(1);
    expect(remainingUnknown[0].id).toBe('2');
  });

  it('should handle sessions with only topics', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)' } as Session,
      { id: '3', prompt: '[TOPIC]: # (Test Topic 2)' } as Session,
      { id: '4', prompt: '[TOPIC]: # (Test Topic 1)' } as Session,
    ];

    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);

    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('Test Topic 1')).toHaveLength(2);
    expect(groupedSessions.get('Test Topic 2')).toHaveLength(1);
    expect(remainingUnknown).toHaveLength(0);
  });

  it('should handle sessions with no topics', () => {
    const sessions: Session[] = [
      { id: '1', prompt: 'No topic here' } as Session,
      { id: '2', prompt: 'Another one without a topic' } as Session,
    ];

    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);

    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown).toHaveLength(2);
  });

  it('should handle an empty array of sessions', () => {
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic([]);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown).toHaveLength(0);
  });
});

describe('createDynamicJobs', () => {
  it('should create dynamic jobs from grouped sessions', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('Test Job 1', [
      { id: '1', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } } as Session,
      { id: '2', createTime: '2023-01-01T13:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } } as Session,
    ]);
    groupedSessions.set('Test Job 2', [
      { id: '3', createTime: '2023-01-02T12:00:00Z', sourceContext: { source: 'repo2', githubRepoContext: { startingBranch: 'develop' } } } as Session,
    ]);

    const jobs = createDynamicJobs(groupedSessions);

    expect(jobs).toHaveLength(2);
    expect(jobs[0].name).toBe('Test Job 1');
    expect(jobs[0].sessionIds).toEqual(['1', '2']);
    expect(jobs[0].repo).toBe('repo1');
    expect(jobs[0].branch).toBe('main');
    expect(jobs[0].createdAt).toBe('2023-01-01T13:00:00Z');
  });

  it('should handle missing source context gracefully', () => {
    const groupedSessions = new Map<string, Session[]>();
    groupedSessions.set('Test Job 1', [
      { id: '1', createTime: '2023-01-01T12:00:00Z' } as Session,
    ]);

    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs[0].repo).toBe('unknown');
    expect(jobs[0].branch).toBe('unknown');
  });

  it('should handle an empty map of grouped sessions', () => {
    const jobs = createDynamicJobs(new Map());
    expect(jobs).toHaveLength(0);
  });
});
