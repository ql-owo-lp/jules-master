
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CreateJobForm } from '@/components/create-job-form';
import { Toaster } from '@/components/ui/toaster';

// Mock the createJob server action
vi.mock('@/app/jobs/actions', () => ({
  createJob: vi.fn(),
}));

test('CreateJobForm renders and submits', async () => {
  const handleJobCreated = vi.fn();
  render(
    <>
      <Toaster />
      <CreateJobForm onJobCreated={handleJobCreated} />
    </>
  );

  // Fill out the form
  fireEvent.change(screen.getByLabelText('Job Name'), {
    target: { value: 'Test Job' },
  });
  fireEvent.change(screen.getByLabelText('Repository'), {
    target: { value: 'test/repo' },
  });
  fireEvent.change(screen.getByLabelText('Branch'), {
    target: { value: 'main' },
  });
  fireEvent.change(screen.getByLabelText('Prompts'), {
    target: { value: 'Prompt 1\nPrompt 2' },
  });

  // Submit the form
  fireEvent.click(screen.getByRole('button', { name: 'Create Job' }));

  // Wait for the form to submit and check that the onJobCreated function was called
  await waitFor(() => {
    expect(handleJobCreated).toHaveBeenCalled();
  });
});
