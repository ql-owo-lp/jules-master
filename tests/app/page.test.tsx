
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePageContent from '@/app/page';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('?status=COMPLETED'),
  useRouter: vi.fn(),
}));

vi.mock('@/components/env-provider', () => ({
  useEnv: () => ({
    hasJulesApiKey: true,
    hasGithubToken: true,
  }),
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
    (useLocalStorage as Mock).mockImplementation((key, initialValue) => {
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

  it('should select all filtered sessions when the "select all" checkbox is clicked', async () => {
    render(<HomePageContent />);
    const user = userEvent.setup();

    const selectAllCheckbox = screen.getByLabelText('Select all sessions for job Job 1');
    expect(selectAllCheckbox).not.toBeChecked();

    await user.click(selectAllCheckbox);

    expect(selectAllCheckbox).toBeChecked();
  });
  
  it('should navigate to the correct page when onJobPageChange is called', () => {
    const push = vi.fn();
    (useRouter as Mock).mockReturnValue({ push });

    const jobsForPagination = [
      { id: 'job1', name: 'Job 1', sessionIds: ['session1'], repo: 'repo1', createdAt: new Date().toISOString() },
      { id: 'job2', name: 'Job 2', sessionIds: ['session2'], repo: 'repo2', createdAt: new Date().toISOString() },
    ];
    const sessionsForPagination = [
      { id: 'session1', title: 'Session 1', state: 'COMPLETED', createTime: new Date().toISOString() },
      { id: 'session2', title: 'Session 2', state: 'COMPLETED', createTime: new Date().toISOString() },
    ];

    (useLocalStorage as Mock).mockImplementation((key, initialValue) => {
      if (key === 'jules-jobs') {
        return [jobsForPagination, vi.fn()];
      }
      if (key === 'jules-sessions') {
        return [sessionsForPagination, vi.fn()];
      }
      if (key === 'jules-jobs-per-page') {
        return [1, vi.fn()];
      }
      return [initialValue, vi.fn()];
    });

    render(<HomePageContent />);

    // Simulate clicking the next page button
    const nextPageButton = screen.getByRole('button', { name: /next/i });
    nextPageButton.click();

    expect(push).toHaveBeenCalledWith('?status=COMPLETED&jobPage=2');
  });
});
