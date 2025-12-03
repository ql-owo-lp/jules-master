
// @vitest-environment jsdom
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { SessionList } from '@/components/session-list';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('SessionList', () => {
  it('should render', () => {
    render(
      <SessionList
        sessions={[]}
        jobs={[]}
        unknownSessions={[]}
        quickReplies={[]}
        lastUpdatedAt={null}
        onRefresh={() => {}}
        isRefreshing={false}
        isActionPending={false}
        onApprovePlan={() => {}}
        onSendMessage={() => {}}
        onBulkSendMessage={() => {}}
        countdown={0}
        pollInterval={0}
        jobIdParam={null}
        statusFilter="all"
        titleTruncateLength={50}
        jobPage={1}
        totalJobPages={1}
        onJobPageChange={() => {}}
      >
        <div />
      </SessionList>
    );
  });

  it('should display the progress bar when a job is in a "PROCESSING" or "PENDING" state', () => {
    render(
      <SessionList
        sessions={[]}
        jobs={[
          {
            id: 'job-1',
            name: 'Test Job',
            status: 'PROCESSING',
            sessionIds: [],
            sessionCount: 10,
            repo: 'test-repo',
            branch: 'test-branch',
            createdAt: new Date().toISOString(),
          },
        ]}
        unknownSessions={[]}
        quickReplies={[]}
        lastUpdatedAt={null}
        onRefresh={() => {}}
        isRefreshing={false}
        isActionPending={false}
        onApprovePlan={() => {}}
        onSendMessage={() => {}}
        onBulkSendMessage={() => {}}
        countdown={0}
        pollInterval={0}
        jobIdParam={null}
        statusFilter="all"
        titleTruncateLength={50}
        jobPage={1}
        totalJobPages={1}
        onJobPageChange={() => {}}
      >
        <div />
      </SessionList>
    );

    const accordionTrigger = screen.getByText('Test Job');
    act(() => {
      accordionTrigger.click();
    });

    waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeNull();
    });
  });

  it('should display the progress bar when a job is in a "PENDING" state', () => {
    render(
      <SessionList
        sessions={[]}
        jobs={[
          {
            id: 'job-1',
            name: 'Test Job',
            status: 'PENDING',
            sessionIds: [],
            sessionCount: 10,
            repo: 'test-repo',
            branch: 'test-branch',
            createdAt: new Date().toISOString(),
          },
        ]}
        unknownSessions={[]}
        quickReplies={[]}
        lastUpdatedAt={null}
        onRefresh={() => {}}
        isRefreshing={false}
        isActionPending={false}
        onApprovePlan={() => {}}
        onSendMessage={() => {}}
        onBulkSendMessage={() => {}}
        countdown={0}
        pollInterval={0}
        jobIdParam={null}
        statusFilter="all"
        titleTruncateLength={50}
        jobPage={1}
        totalJobPages={1}
        onJobPageChange={() => {}}
      >
        <div />
      </SessionList>
    );

    const accordionTrigger = screen.getByText('Test Job');
    act(() => {
      accordionTrigger.click();
    });

    waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeNull();
    });
  });

  it('should display "No jobs found" when there are no jobs', () => {
    render(
      <SessionList
        sessions={[]}
        jobs={[]}
        unknownSessions={[]}
        quickReplies={[]}
        lastUpdatedAt={null}
        onRefresh={() => {}}
        isRefreshing={false}
        isActionPending={false}
        onApprovePlan={() => {}}
        onSendMessage={() => {}}
        onBulkSendMessage={() => {}}
        countdown={0}
        pollInterval={0}
        jobIdParam={null}
        statusFilter="all"
        titleTruncateLength={50}
        jobPage={1}
        totalJobPages={1}
        onJobPageChange={() => {}}
      >
        <div />
      </SessionList>
    );

    expect(screen.getByText('No jobs found')).not.toBeNull();
  });

  it('should display uncategorized sessions', () => {
    render(
      <SessionList
        sessions={[
          {
            id: 'session-1',
            title: 'Uncategorized Session',
            state: 'COMPLETED',
            createTime: new Date().toISOString(),
          },
        ]}
        jobs={[]}
        unknownSessions={[
          {
            id: 'session-1',
            title: 'Uncategorized Session',
            state: 'COMPLETED',
            createTime: new Date().toISOString(),
          },
        ]}
        quickReplies={[]}
        lastUpdatedAt={null}
        onRefresh={() => {}}
        isRefreshing={false}
        isActionPending={false}
        onApprovePlan={() => {}}
        onSendMessage={() => {}}
        onBulkSendMessage={() => {}}
        countdown={0}
        pollInterval={0}
        jobIdParam={null}
        statusFilter="all"
        titleTruncateLength={50}
        jobPage={1}
        totalJobPages={1}
        onJobPageChange={() => {}}
      >
        <div />
      </SessionList>
    );

    expect(screen.getByText('Uncategorized Sessions')).not.toBeNull();
  });

  it('should not hide the job when the status filter is applied and there are no matching sessions', () => {
    render(
      <SessionList
        sessions={[
          {
            id: 'session-1',
            title: 'Test Session',
            state: 'COMPLETED',
            createTime: new Date().toISOString(),
          },
        ]}
        jobs={[
          {
            id: 'job-1',
            name: 'Test Job',
            status: 'COMPLETED',
            sessionIds: ['session-1'],
            sessionCount: 1,
            repo: 'test-repo',
            branch: 'test-branch',
            createdAt: new Date().toISOString(),
          },
        ]}
        unknownSessions={[]}
        quickReplies={[]}
        lastUpdatedAt={null}
        onRefresh={() => {}}
        isRefreshing={false}
        isActionPending={false}
        onApprovePlan={() => {}}
        onSendMessage={() => {}}
        onBulkSendMessage={() => {}}
        countdown={0}
        pollInterval={0}
        jobIdParam={null}
        statusFilter="AWAITING_PLAN_APPROVAL"
        titleTruncateLength={50}
        jobPage={1}
        totalJobPages={1}
        onJobPageChange={() => {}}
      >
        <div />
      </SessionList>
    );

    expect(screen.queryByText('Test Job')).not.toBeNull();
  });
});
