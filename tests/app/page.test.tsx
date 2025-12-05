
import React from 'react';
import { render, screen } from '@testing-library/react';
import HomePageContent from '@/app/page';
import { vi } from 'vitest';
import { useLocalStorage } from '@/hooks/use-local-storage';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('?status=COMPLETED'),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/components/env-provider', () => ({
  useEnv: () => ({
    julesApiKey: 'test-api-key',
    githubToken: 'test-github-token',
  }),
}));

vi.mock('@/hooks/use-local-storage');

vi.mock('@/components/profile-provider', () => ({
  useProfile: () => ({
    currentProfile: { id: 'test-profile-id', name: 'Test Profile' },
    refreshProfiles: vi.fn(),
  }),
}));

const mockJobs = [
  { id: 'job1', name: 'Job 1', sessionIds: ['session1'], repo: 'repo1', createdAt: new Date().toISOString() },
  { id: 'job2', name: 'Job 2', sessionIds: ['session2'], repo: 'repo2', createdAt: new Date().toISOString() },
];

const mockSessions = [
  { id: 'session1', title: 'Session 1', state: 'COMPLETED', createTime: new Date().toISOString() },
  { id: 'session2', title: 'Session 2', state: 'RUNNING', createTime: new Date().toISOString() },
];

describe('HomePageContent', () => {
  beforeEach(() => {
    (useLocalStorage as jest.Mock).mockImplementation((key, initialValue) => {
      if (key === 'jules-jobs') {
        return [mockJobs, vi.fn()];
      }
      if (key === 'jules-sessions') {
        return [mockSessions, vi.fn()];
      }
      return [initialValue, vi.fn()];
    });
  });

  it('should filter jobs by status', () => {
    render(<HomePageContent />);

    const job1Card = screen.getByText('Job 1');
    expect(job1Card).toBeInTheDocument();

    const job2Card = screen.queryByText('Job 2');
    expect(job2Card).not.toBeInTheDocument();
  });
});
