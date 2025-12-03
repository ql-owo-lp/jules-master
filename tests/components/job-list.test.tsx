
import React from 'react';
import { render, screen } from '@testing-library/react';
import { JobList } from '@/components/job-list';
import { Job } from '@/lib/types';
import { vi } from 'vitest';

const mockJobs: Job[] = [
  {
    id: '1',
    name: 'Test Job 1',
    repo: 'test/repo1',
    createdAt: new Date().toISOString(),
    sessionIds: ['1', '2'],
  },
  {
    id: '2',
    name: 'Test Job 2',
    repo: 'test/repo2',
    createdAt: new Date().toISOString(),
    sessionIds: ['3'],
  },
];

describe('JobList', () => {
  it('should render a list of jobs', () => {
    render(<JobList jobs={mockJobs} />);

    expect(screen.getByText('Test Job 1')).toBeInTheDocument();
    expect(screen.getByText('test/repo1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    expect(screen.getByText('Test Job 2')).toBeInTheDocument();
    expect(screen.getByText('test/repo2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should render a message when there are no jobs', () => {
    render(<JobList jobs={[]} />);
    expect(screen.getByText('No jobs found.')).toBeInTheDocument();
  });
});
