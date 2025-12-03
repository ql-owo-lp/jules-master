
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { SessionList } from '@/components/session-list';
import { Job, Session } from '@/lib/types';

describe('SessionList', () => {
  const mockJobs: Job[] = [
    {
      id: 'job-1',
      name: 'Test Job',
      repo: 'test/repo',
      branch: 'main',
      status: 'COMPLETED',
      sessionIds: ['session-1', 'session-2', 'session-3'],
      sessionCount: 3,
      createdAt: new Date().toISOString(),
    },
  ];

  const mockSessions: Session[] = [
    {
      id: 'session-1',
      title: 'Session 1',
      state: 'COMPLETED',
      createTime: new Date().toISOString(),
    },
    {
      id: 'session-2',
      title: 'Session 2',
      state: 'WORKING',
      createTime: new Date().toISOString(),
    },
    {
      id: 'session-3',
      title: 'Session 3',
      state: 'COMPLETED',
      createTime: new Date().toISOString(),
    },
  ];

  it('should only select filtered sessions when "select all" is clicked', () => {
    const { getByLabelText, getAllByRole, getByText } = render(
      <SessionList
        jobs={mockJobs}
        sessions={mockSessions}
        statusFilter="COMPLETED"
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
        titleTruncateLength={50}
        jobPage={1}
        totalJobPages={1}
        onJobPageChange={() => {}}
      >
        <div></div>
      </SessionList>
    );

    const accordionTrigger = getByText('Test Job');
    fireEvent.click(accordionTrigger);

    const selectAllCheckbox = getByLabelText('Select all sessions for job Test Job');
    fireEvent.click(selectAllCheckbox);

    const selectedCheckboxes = getAllByRole('checkbox', { checked: true });
    expect(selectedCheckboxes.length).toBe(3);
  });
});
