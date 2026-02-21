import React from 'react';
import { render, screen } from '@testing-library/react';
import { SessionList } from '@/components/session-list';
import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('@/components/new-job-dialog', () => ({
  NewJobDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('@/hooks/use-local-storage', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useLocalStorage: (key: string, initialValue: any) => [initialValue, vi.fn()],
}));

vi.mock('@/components/env-provider', () => ({
  useEnv: () => ({ hasJulesApiKey: true }),
}));

vi.mock('@/components/poll-countdown', () => ({
  PollCountdown: () => <div>PollCountdown</div>
}));

vi.mock('@/components/message-dialog', () => ({
    MessageDialog: () => <div>MessageDialog</div>
}));

describe('SessionList Empty State', () => {
  const defaultProps = {
    sessionMap: new Map(),
    jobs: [],
    unknownSessions: [],
    quickReplies: [],
    lastUpdatedAt: Date.now(),
    onRefresh: vi.fn(),
    onApprovePlan: vi.fn(),
    onSendMessage: vi.fn(),
    onBulkSendMessage: vi.fn(),
    pollInterval: 60,
    jobIdParam: null,
    statusFilter: 'all',
    titleTruncateLength: 50,
    jobPage: 1,
    totalJobPages: 1,
    onJobPageChange: vi.fn(),
    children: <div>Filters</div>,
  };

  it('renders "No jobs found" when no filters are active', () => {
    render(<SessionList {...defaultProps} isAnyFilterActive={false} />);
    expect(screen.getByText('No jobs found')).toBeInTheDocument();
    expect(screen.getByText('Create a new job to see jobs and sessions here.')).toBeInTheDocument();
  });

  it('renders "No matching jobs found" when filters are active', () => {
    render(<SessionList {...defaultProps} isAnyFilterActive={true} />);
    expect(screen.getByText('No matching jobs found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters or search terms.')).toBeInTheDocument();
  });

  it('shows "Clear Filters" button when filters are active and onClearFilters is provided', () => {
    const onClearFilters = vi.fn();
    render(<SessionList {...defaultProps} isAnyFilterActive={true} onClearFilters={onClearFilters} />);
    const button = screen.getByRole('button', { name: /Clear Filters/i });
    expect(button).toBeInTheDocument();
    button.click();
    expect(onClearFilters).toHaveBeenCalled();
  });
});
