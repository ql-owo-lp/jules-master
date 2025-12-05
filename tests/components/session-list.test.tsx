
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionList } from '@/components/session-list';
import { MOCK_JOBS, MOCK_SESSIONS } from './mock-data';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('SessionList', () => {
    it('should display "No jobs found" when there are no jobs or sessions', () => {
        render(
            <SessionList
                sessions={[]}
                jobs={[]}
                unknownSessions={[]}
                quickReplies={[]}
                lastUpdatedAt={null}
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
        expect(screen.getByText('No jobs found')).toBeInTheDocument();
    });

  it('should render jobs and sessions correctly', async () => {
    const user = userEvent.setup();
    render(
      <SessionList
        sessions={MOCK_SESSIONS}
        jobs={MOCK_JOBS}
        unknownSessions={[]}
        quickReplies={[]}
        lastUpdatedAt={new Date()}
        onRefresh={() => {}}
        countdown={60}
        pollInterval={60}
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

    // Check for job name and creation time
    expect(screen.getByText('Test Job 1')).toBeInTheDocument();
    expect(screen.getByText(/ago$/)).toBeInTheDocument();

    // Click to expand the job's sessions
    await user.click(screen.getByText('Test Job 1'));

    // Check for session title
    expect(await screen.findByText('Session 1 for Job 1')).toBeInTheDocument();
  });
});
