
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { SessionList } from '../../src/components/session-list';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  isReady: true,
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

describe('SessionList', () => {
  it('should only select visible sessions when the job checkbox is clicked', () => {
    const sessions = [
      { id: '1', state: 'COMPLETED', title: 'Session 1', createTime: '2023-01-01T12:00:00Z' },
      { id: '2', state: 'AWAITING_PLAN_APPROVAL', title: 'Session 2', createTime: '2023-01-01T12:00:00Z' },
    ];
    const jobs = [{ id: 'job1', name: 'Job 1', sessionIds: ['1', '2'] }];
    const onApprovePlan = vi.fn();
    const onSendMessage = vi.fn();
    const onBulkSendMessage = vi.fn();

    const props = {
      sessions: sessions,
      jobs: jobs,
      statusFilter: 'COMPLETED',
      onApprovePlan: onApprovePlan,
      unknownSessions: [],
      quickReplies: [],
      lastUpdatedAt: null,
      onRefresh: () => {},
      countdown: 0,
      pollInterval: 0,
      jobIdParam: null,
      children: null,
      titleTruncateLength: 50,
      jobPage: 1,
      totalJobPages: 1,
      onJobPageChange: () => {},
      onSendMessage: onSendMessage,
      onBulkSendMessage: onBulkSendMessage,
    };

    const { rerender } = render(<SessionList {...props} />);

    // Click the accordion to show the sessions
    fireEvent.click(screen.getByText('Job 1'));

    // Click the "select all" checkbox for the job
    fireEvent.click(screen.getByLabelText('Select all sessions for job Job 1'));

    // Re-render with no filter
    rerender(<SessionList {...props} statusFilter="all" />);

    // With the bug, both sessions will be selected. The correct behavior is that only session 1 is selected.
    expect(screen.getByLabelText('Select session 1')).toBeChecked();
    expect(screen.getByLabelText('Select session 2')).not.toBeChecked();
  });
});
