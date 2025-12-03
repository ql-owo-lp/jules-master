
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { SessionList } from '@/components/session-list';
import { vi } from 'vitest';
import '@testing-library/jest-dom';

const mockSessions = [
  { id: '1', title: 'Session 1', state: 'COMPLETED', createTime: '2023-01-01T12:00:00Z', sessionIds:['s1'], repo:'repo', branch: 'main' , createdAt: new Date().toISOString() },
  { id: '2', title: 'Session 2', state: 'AWAITING_PLAN_APPROVAL', createTime: '2023-01-01T12:00:00Z', sessionIds:['s2'], repo:'repo', branch: 'main' , createdAt: new Date().toISOString()},
  { id: '3', title: 'Session 3', state: 'AWAITING_PLAN_APPROVAL', createTime: '2023-01-01T12:00:00Z', sessionIds:['s3'], repo:'repo', branch: 'main' , createdAt: new Date().toISOString()},
];

const mockJobs = [
  { id: 'job1', name: 'Job 1', sessionIds: ['1', '2', '3'], repo: 'test/repo', branch: 'main', createdAt: '2023-01-01T12:00:00Z' },
];

const mockRouter = {
  push: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

describe('SessionList', () => {
  it('should only select filtered sessions when "select all" is clicked', () => {
    render(
        <SessionList
        sessions={mockSessions}
        jobs={mockJobs}
        unknownSessions={[]}
        quickReplies={[]}
        lastUpdatedAt={new Date()}
        onRefresh={() => {}}
        countdown={60}
        pollInterval={60}
        jobIdParam={null}
        statusFilter="AWAITING_PLAN_APPROVAL"
        titleTruncateLength={50}
        jobPage={1}
        totalJobPages={1}
        onJobPageChange={() => {}}
        onApprovePlan={() => {}}
        onSendMessage={() => {}}
        onBulkSendMessage={() => {}}
      >
        <div />
      </SessionList>
    );
    const accordionTrigger = screen.getByText('Job 1');
    fireEvent.click(accordionTrigger);

    const selectAllCheckbox = screen.getByLabelText('Select all sessions for job Job 1');
    fireEvent.click(selectAllCheckbox);

    // The row is the parent of the cell with the session title
    const session2Row = screen.getByText('Session 2').closest('tr');
    const session3Row = screen.getByText('Session 3').closest('tr');

    expect(screen.queryByText('Session 1')).toBeNull();
    expect(session2Row).toHaveAttribute('data-state', 'selected');
    expect(session3Row).toHaveAttribute('data-state', 'selected');
  });
});
