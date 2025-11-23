import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '../src/lib/utils';
import type { Session, Job } from '../src/lib/types';

describe('groupSessionsByTopic', () => {
  it('should group sessions by topic', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)', createTime: new Date().toISOString() },
      { id: '2', prompt: '[TOPIC]: # (Test Topic 2)', createTime: new Date().toISOString() },
      { id: '3', prompt: '[TOPIC]: # (Test Topic 1)', createTime: new Date().toISOString() },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(2);
    expect(groupedSessions.get('Test Topic 1')?.length).toBe(2);
    expect(groupedSessions.get('Test Topic 2')?.length).toBe(1);
    expect(remainingUnknown.length).toBe(0);
  });

  it('should handle sessions without topics', () => {
    const sessions: Session[] = [
      { id: '1', prompt: 'No topic here', createTime: new Date().toISOString() },
      { id: '2', prompt: 'Another one without a topic', createTime: new Date().toISOString() },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(2);
  });

  it('should handle a mix of sessions with and without topics', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)', createTime: new Date().toISOString() },
      { id: '2', prompt: 'No topic here', createTime: new Date().toISOString() },
      { id: '3', prompt: '[TOPIC]: # (Test Topic 1)', createTime: new Date().toISOString() },
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(1);
    expect(groupedSessions.get('Test Topic 1')?.length).toBe(2);
    expect(remainingUnknown.length).toBe(1);
  });

  it('should handle an empty array of sessions', () => {
    const sessions: Session[] = [];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(0);
  });

  it('should handle sessions with malformed topics', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1', createTime: new Date().toISOString() }, // Missing closing parenthesis
      { id: '2', prompt: 'TOPIC: # (Test Topic 2)', createTime: new Date().toISOString() }, // Missing brackets
    ];
    const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
    expect(groupedSessions.size).toBe(0);
    expect(remainingUnknown.length).toBe(2);
  });
});

describe('createDynamicJobs', () => {
  it('should create dynamic jobs from grouped sessions', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)', createTime: '2023-01-01T12:00:00.000Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
      { id: '2', prompt: '[TOPIC]: # (Test Topic 1)', createTime: '2023-01-01T13:00:00.000Z', sourceContext: { source: 'repo1', githubRepoContext: { startingBranch: 'main' } } },
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    expect(jobs[0].name).toBe('Test Topic 1');
    expect(jobs[0].sessionIds).toEqual(['1', '2']);
    expect(jobs[0].createdAt).toBe('2023-01-01T13:00:00.000Z');
    expect(jobs[0].repo).toBe('repo1');
    expect(jobs[0].branch).toBe('main');
  });

  it('should handle an empty map of grouped sessions', () => {
    const groupedSessions = new Map<string, Session[]>();
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(0);
  });

  it('should handle sessions with missing source context', () => {
    const sessions: Session[] = [
      { id: '1', prompt: '[TOPIC]: # (Test Topic 1)', createTime: new Date().toISOString() },
    ];
    const { groupedSessions } = groupSessionsByTopic(sessions);
    const jobs = createDynamicJobs(groupedSessions);
    expect(jobs.length).toBe(1);
    expect(jobs[0].repo).toBe('unknown');
    expect(jobs[0].branch).toBe('unknown');
  });
});
