import { describe, it, expect } from 'vitest';
import { cn, groupSessionsByTopic, createDynamicJobs } from '@/lib/utils';
import { Session } from '@/lib/types';

describe('cn', () => {
  it('should return a string of class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should merge and not deduplicate class names', () => {
    expect(cn('foo', 'bar', 'foo')).toBe('foo bar foo');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', { bar: true, baz: false })).toBe('foo bar');
  });

  it('should handle tailwind-merge conflicts', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('should ignore falsy values', () => {
    expect(cn('foo', null, undefined, false, 'bar')).toBe('foo bar');
  });
});

describe('groupSessionsByTopic', () => {
  it('should group sessions by topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (foo)\nbar' },
      { id: '2', prompt: '[TOPIC]: # (foo)\nbaz' },
      { id: '3', prompt: '[TOPIC]: # (bar)\nqux' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('foo')).toHaveLength(2);
    expect(groupedSessions.get('bar')).toHaveLength(1);
    expect(remainingUnknown).toHaveLength(0);
  });

  it('should handle sessions with no topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: 'foo' },
      { id: '2', prompt: '[TOPIC]: # (bar)\nbaz' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(1);
    expect(groupedSessions.get('bar')).toHaveLength(1);
    expect(remainingUnknown).toHaveLength(1);
  });

  it('should handle sessions with no prompt', () => {
    const sessions: Session[] = [
      { id: '1' },
      { id: '2', prompt: '[TOPIC]: # (bar)\nbaz' },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(1);
    expect(groupedSessions.get('bar')).toHaveLength(1);
    expect(remainingUnknown).toHaveLength(1);
  });

  it('should handle an empty array of sessions', () => {
    const sessions: Session[] = [];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown).toHaveLength(0);
  });
});

describe('createDynamicJobs', () => {
  it('should create dynamic jobs from grouped sessions', () => {
    const sessions1: Session[] = [
      { id: '1', createTime: '2023-01-01T00:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
      { id: '2', createTime: '2023-01-02T00:00:00Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
    ];
    const sessions2: Session[] = [
      { id: '3', createTime: '2023-01-03T00:00:00Z', sourceContext: { source: 'repo2', githubRepoContext: { startingBranch: 'dev' } } },
    ];
    const groupedSessions = new Map<string, Session[]>([
      ['foo', sessions1],
      ['bar', sessions2],
    ]);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].name).toBe('foo');
    expect(jobs[0].sessionIds).toEqual(['1', '2']);
    expect(jobs[0].repo).toBe('repo1');
    expect(jobs[0].branch).toBe('main');
    expect(jobs[0].createdAt).toBe('2023-01-02T00:00:00Z');
    expect(jobs[1].name).toBe('bar');
    expect(jobs[1].sessionIds).toEqual(['3']);
    expect(jobs[1].repo).toBe('repo2');
    expect(jobs[1].branch).toBe('dev');
    expect(jobs[1].createdAt).toBe('2023-01-03T00:00:00Z');
  });

  it('should handle an empty map of grouped sessions', () => {
    const groupedSessions = new Map<string, Session[]>();
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs).toHaveLength(0);
  });

  it('should handle sessions with missing data', () => {
    const sessions: Session[] = [
      { id: '1' },
    ];
    const groupedSessions = new Map<string, Session[]>([
      ['foo', sessions],
    ]);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].name).toBe('foo');
    expect(jobs[0].sessionIds).toEqual(['1']);
    expect(jobs[0].repo).toBe('unknown');
    expect(jobs[0].branch).toBe('unknown');
    expect(jobs[0].createdAt).toBeDefined();
  });
});
