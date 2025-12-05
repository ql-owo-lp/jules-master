
import React from 'react';
import { render, screen } from '@testing-library/react';
import HomePageContent from '@/app/page';
import { vi } from 'vitest';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { ProfileProvider } from '@/components/profile-provider';

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

// Mock ProfileProvider to avoid fetching
vi.mock('@/components/profile-provider', () => ({
  ProfileProvider: ({ children }: any) => <div>{children}</div>,
  useProfile: () => ({
    currentProfileId: 'test-profile',
    setCurrentProfileId: vi.fn(),
    profiles: [{ id: 'test-profile', name: 'Test Profile' }],
    refreshProfiles: vi.fn(),
    isLoading: false
  })
}));

vi.mock('@/hooks/use-local-storage');

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

    // Since ProfileProvider is mocked to return context directly, we don't need to wrap it again if HomePageContent uses useProfile
    // However, if HomePageContent is wrapped in Page component in real app, we are testing the exported default component which is usually the Page.
    // In the test, we import HomePageContent from '@/app/page'.
    // Wait, `HomePageContent` is not exported by default, `Home` is.
    // The test imports `HomePageContent`? No, it imports default as HomePageContent.

    // In `src/app/page.tsx`:
    // export default function Home() { ... }

    // So we are rendering `Home`.

    // We need to verify what Home renders. It renders `HomePageContent` wrapped in Suspense.
    // And `HomePageContent` calls `useProfile`.

    // Since we mocked `useProfile` globally, it should work.

    // Note: The previous error `useProfile must be used within a ProfileProvider` happened because
    // likely my previous mock wasn't effective or I didn't mock it at all in the previous run.
    // Ah, I didn't mock it at all in previous run. Now I am mocking it.

    const job1Card = screen.getByText('Job 1');
    expect(job1Card).toBeInTheDocument();

    const job2Card = screen.queryByText('Job 2');
    expect(job2Card).not.toBeInTheDocument();
  });
});
