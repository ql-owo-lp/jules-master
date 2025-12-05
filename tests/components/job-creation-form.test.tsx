import React from 'react';
import { JobCreationForm } from '@/components/job-creation-form';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom'
import * as configActions from '@/app/config/actions';

vi.mock('@/app/config/actions');

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

test('JobCreationForm should submit with correct values for foreground jobs', async () => {
  const mockOnCreateJob = vi.fn().mockResolvedValue({ id: 'session-123' });
  const mockOnJobsCreated = vi.fn();

  const selectedSource = {
    name: 'test-source',
    githubRepo: {
      owner: 'test-owner',
      repo: 'test-repo',
      defaultBranch: { displayName: 'main', sha: '123' },
      branches: [{ displayName: 'main', sha: '123' }],
    },
  };
  localStorage.setItem('jules-last-source', JSON.stringify(selectedSource));
  localStorage.setItem('jules-last-branch', JSON.stringify('main'));

  const mockedAddJob = vi.spyOn(configActions, 'addJob').mockResolvedValue(undefined);

  render(
    <JobCreationForm
      onJobsCreated={mockOnJobsCreated}
      onCreateJob={mockOnCreateJob}
    />
  );

  // Wait for the component to finish its initial render and effects
  await waitFor(() => {
    expect(screen.getByLabelText('Background Job')).toBeInTheDocument();
  });

  // Uncheck the "Background Job" switch
  fireEvent.click(screen.getByLabelText('Background Job'));

  // Check the "Require Plan Approval" switch
  fireEvent.click(screen.getByLabelText('Require Plan Approval'));

  // Set a prompt
  fireEvent.change(screen.getByLabelText('Session Prompts'), { target: { value: 'Test Prompt' } });

  // Submit the form
  fireEvent.click(screen.getByText('Create Job'));

  // Check that addJob was called with the correct values
  await waitFor(() => {
    expect(mockedAddJob).toHaveBeenCalledWith(expect.objectContaining({
      requirePlanApproval: true,
      automationMode: 'AUTO_CREATE_PR', // This is the default value
      background: false,
    }));
  });
});
