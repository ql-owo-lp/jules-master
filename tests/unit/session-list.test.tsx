
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionList } from '@/components/session-list';
import { Job, Session } from '@/lib/types';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock child components and hooks
vi.mock('@/components/job-status-badge', () => ({
  JobStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));
vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: (key: string, initialValue: any) => [initialValue, vi.fn()],
}));

const mockJobs: Job[] = [
  {
    id: 'job-1',
    name: 'Test Job 1',
    sessionIds: ['session-1'],
    createdAt: new Date().toISOString(),
    repo: 'test-owner/test-repo',
    branch: 'main',
  },
];

const mockSessions: Session[] = [
  {
    id: 'session-1',
    name: 'sessions/session-1',
    title: 'Test Session 1',
    prompt: '[TOPIC]: # (Test Job 1)',
    state: 'COMPLETED',
    createTime: new Date().toISOString(),
  },
  {
    id: 'session-2',
    name: 'sessions/session-2',
    title: 'Uncategorized Session',
    prompt: 'A session without a topic.',
    state: 'IN_PROGRESS',
    createTime: new Date().toISOString(),
  },
];

describe('SessionList', () => {
  it('renders the job title and creation time', () => {
    render(
      <SessionList
        jobs={mockJobs}
        sessions={mockSessions}
        unknownSessions={[]}
        quickReplies={[]}
        lastUpdatedAt={new Date()}
        onRefresh={() => {}}
        countdown={0}
        pollInterval={0}
        jobIdParam={null}
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

    expect(screen.getByText('Test Job 1')).toBeInTheDocument();
    expect(screen.getByText(/ago/)).toBeInTheDocument();
  });

  it('renders sessions under the correct job after opening the accordion', async () => {
    render(
      <SessionList
        jobs={mockJobs}
        sessions={mockSessions}
        unknownSessions={[]}
        quickReplies={[]}
        lastUpdatedAt={new Date()}
        onRefresh={() => {}}
        countdown={0}
        pollInterval={0}
        jobIdParam={null}
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

    await userEvent.click(screen.getByText('Test Job 1'));

    expect(await screen.findByText('Test Session 1')).toBeInTheDocument();
    expect(screen.queryByText('Uncategorized Session')).not.toBeInTheDocument();
  });

  it('renders uncategorized sessions separately after opening the accordion', async () => {
    render(
      <SessionList
        jobs={[]}
        sessions={mockSessions}
        unknownSessions={[mockSessions[1]]}
        quickReplies={[]}
        lastUpdatedAt={new Date()}
        onRefresh={() => {}}
        countdown={0}
        pollInterval={0}
        jobIdParam={null}
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

    await userEvent.click(screen.getByText('Uncategorized Sessions'));

    expect(await screen.findByText('Uncategorized Session')).toBeInTheDocument();
    expect(screen.queryByText('Test Session 1')).not.toBeInTheDocument();
  });
});
