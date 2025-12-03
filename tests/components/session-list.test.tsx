
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { SessionList } from '@/components/session-list';
import { vi } from 'vitest';
import { Session, Job } from '@/lib/types';

const mockJobs: Job[] = [
  {
    id: 'job-1',
    name: 'Test Job 1',
    repo: 'test-repo',
    branch: 'main',
    sessionIds: ['session-1'],
    createdAt: new Date().toISOString(),
    status: 'COMPLETED',
  },
];

const mockSessions: Session[] = [
  {
    id: 'session-1',
    title: 'Test Session 1',
    state: 'COMPLETED',
    createTime: new Date().toISOString(),
    url: 'http://localhost/session-1',
    outputs: [],
  },
];

const mockRouter = {
  push: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams('?jobId=job-1&repo=test-repo&status=COMPLETED'),
}));

describe('SessionList', () => {
  it('should preserve all query parameters when navigating to a session', () => {
    render(
      <SessionList
        jobs={mockJobs}
        sessions={mockSessions}
        unknownSessions={[]}
        quickReplies={[]}
        lastUpdatedAt={new Date()}
        onRefresh={() => {}}
        countdown={60}
        pollInterval={60}
        jobIdParam="job-1"
        statusFilter="all"
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

    fireEvent.click(screen.getByText('Test Session 1'));

    expect(mockRouter.push).toHaveBeenCalledWith(
      '/sessions/session-1?jobId=job-1&repo=test-repo&status=COMPLETED'
    );
  });
});
