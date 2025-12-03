/** @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SessionList } from '@/components/session-list';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('SessionList', () => {
  const mockJobs = [
    { id: 'job1', name: 'Job 1', sessionIds: ['session1', 'session2'], repo: 'test/repo', branch: 'main' },
    { id: 'job2', name: 'Job 2', sessionIds: [], repo: 'test/repo', branch: 'main' },
  ];
  const mockSessions = [
    { id: 'session1', title: 'Session 1', state: 'COMPLETED', createTime: new Date().toISOString() },
    { id: 'session2', title: 'Session 2', state: 'WORKING', createTime: new Date().toISOString() },
  ];

  it('should not render a job if it has no sessions', () => {
    render(
      <SessionList
        jobs={mockJobs}
        sessions={mockSessions}
        statusFilter="all"
        onRefresh={() => {}}
        onApprovePlan={() => {}}
        onSendMessage={() => {}}
        onBulkSendMessage={() => {}}
        lastUpdatedAt={new Date()}
        countdown={0}
        pollInterval={0}
        isRefreshing={false}
        isActionPending={false}
        jobIdParam={null}
        unknownSessions={[]}
        quickReplies={[]}
        titleTruncateLength={50}
        jobPage={1}
        totalJobPages={1}
        onJobPageChange={() => {}}
      >
        <div></div>
      </SessionList>
    );

    expect(screen.getByText('Job 1')).toBeInTheDocument();
    expect(screen.queryByText('Job 2')).not.toBeInTheDocument();
  });
});
