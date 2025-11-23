import { describe, it, expect } from 'vitest';
import { groupSessionsByTopic, createDynamicJobs } from '../src/lib/utils';
import { Session } from '../src/lib/types';

describe('groupSessionsByTopic', () => {
    it('should group sessions by topic', () => {
        const sessions: Session[] = [
            { id: '1', prompt: '[TOPIC]: # (Job A)' },
            { id: '2', prompt: '[TOPIC]: # (Job B)' },
            { id: '3', prompt: '[TOPIC]: # (Job A)' },
        ];
        const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
        expect(groupedSessions.size).toBe(2);
        expect(groupedSessions.get('Job A')?.length).toBe(2);
        expect(groupedSessions.get('Job B')?.length).toBe(1);
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
            { id: '1', prompt: '[TOPIC]: # (Job A)' },
            { id: '2', prompt: 'No topic' },
            { id: '3', prompt: '[TOPIC]: # (Job B)' },
        ];
        const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
        expect(groupedSessions.size).toBe(2);
        expect(groupedSessions.get('Job A')?.length).toBe(1);
        expect(groupedSessions.get('Job B')?.length).toBe(1);
        expect(remainingUnknown.length).toBe(1);
    });

    it('should handle an empty array of sessions', () => {
        const sessions: Session[] = [];
        const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
        expect(groupedSessions.size).toBe(0);
        expect(remainingUnknown.length).toBe(0);
    });

    it('should handle sessions with null or undefined prompts', () => {
        const sessions: Session[] = [
            { id: '1', prompt: undefined },
            { id: '2', prompt: null },
            { id: '3', prompt: '[TOPIC]: # (Job A)' },
        ];
        const { groupedSessions, remainingUnknown } = groupSessionsByTopic(sessions);
        expect(groupedSessions.size).toBe(1);
        expect(groupedSessions.get('Job A')?.length).toBe(1);
        expect(remainingUnknown.length).toBe(2);
    });
});

describe('createDynamicJobs', () => {
    it('should create dynamic jobs from grouped sessions', () => {
        const groupedSessions = new Map<string, Session[]>();
        groupedSessions.set('Job A', [
            { id: '1', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'repo/a', githubRepoContext: { startingBranch: 'main' } } },
        ]);
        groupedSessions.set('Job B', [
            { id: '2', createTime: '2023-01-02T12:00:00Z', sourceContext: { source: 'repo/b', githubRepoContext: { startingBranch: 'dev' } } },
        ]);

        const jobs = createDynamicJobs(groupedSessions);
        expect(jobs.length).toBe(2);
        const jobA = jobs.find(j => j.name === 'Job A');
        expect(jobA).toBeDefined();
        expect(jobA?.id).toBe('dynamic-Job A');
        expect(jobA?.repo).toBe('repo/a');
        expect(jobA?.branch).toBe('main');
    });

    it('should handle multiple sessions for a single job', () => {
        const groupedSessions = new Map<string, Session[]>();
        groupedSessions.set('Job A', [
            { id: '1', createTime: '2023-01-01T10:00:00Z', sourceContext: { source: 'repo/a', githubRepoContext: { startingBranch: 'main' } } },
            { id: '2', createTime: '2023-01-01T12:00:00Z', sourceContext: { source: 'repo/a', githubRepoContext: { startingBranch: 'main' } } },
        ]);

        const jobs = createDynamicJobs(groupedSessions);
        expect(jobs.length).toBe(1);
        expect(jobs[0].sessionIds).toEqual(['1', '2']);
        expect(jobs[0].createdAt).toBe('2023-01-01T12:00:00Z');
    });

    it('should handle an empty map', () => {
        const groupedSessions = new Map<string, Session[]>();
        const jobs = createDynamicJobs(groupedSessions);
        expect(jobs.length).toBe(0);
    });

    it('should handle sessions with missing source context', () => {
        const groupedSessions = new Map<string, Session[]>();
        groupedSessions.set('Job A', [
            { id: '1', createTime: '2023-01-01T12:00:00Z' },
        ]);

        const jobs = createDynamicJobs(groupedSessions);
        expect(jobs.length).toBe(1);
        expect(jobs[0].repo).toBe('unknown');
        expect(jobs[0].branch).toBe('unknown');
    });
});
