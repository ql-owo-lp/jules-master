
import type { Job, Session } from '@/lib/types';

export const MOCK_SESSIONS: Session[] = [
  {
    name: 'sessions/mock-1',
    id: 'session-1',
    title: 'Session 1 for Job 1',
    state: 'COMPLETED',
    createTime: '2024-01-01T12:00:00.000Z',
    sourceContext: {
      source: 'sources/github/test-owner/test-repo',
      githubRepoContext: {
        startingBranch: 'main',
      },
    },
    prompt: "This is a mock prompt for session 1",
  },
];

export const MOCK_JOBS: Job[] = [
    {
        id: 'job-1',
        name: 'Test Job 1',
        sessionIds: ['session-1'],
        createdAt: new Date().toISOString(),
        repo: 'test/repo-1',
        branch: 'main',
    }
]
