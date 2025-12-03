
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { JobCreationForm } from '@/components/job-creation-form';
import * as configActions from '@/app/config/actions';
import { useToast } from '@/hooks/use-toast';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/app/config/actions', () => ({
  getPredefinedPrompts: vi.fn().mockResolvedValue([]),
  getGlobalPrompt: vi.fn().mockResolvedValue('Global prompt'),
  getRepoPrompt: vi.fn().mockResolvedValue('Repo prompt'),
  addJob: vi.fn().mockResolvedValue(undefined),
  getHistoryPrompts: vi.fn().mockResolvedValue([]),
  saveHistoryPrompt: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn().mockReturnValue({
    toast: vi.fn(),
  }),
}));

describe('JobCreationForm', () => {
  it('should save the full prompt to history', async () => {
    const onJobsCreated = vi.fn();
    const onCreateJob = vi.fn().mockResolvedValue({ id: '1' });

    const { getByLabelText, getByText } = render(
      <JobCreationForm
        onJobsCreated={onJobsCreated}
        onCreateJob={onCreateJob}
      />
    );

    // Fill out the form
    fireEvent.change(getByLabelText('Prompt'), {
      target: { value: 'Test prompt' },
    });

    // Submit the form
    fireEvent.click(getByText('Create Job'));

    // Wait for the form to be submitted
    await waitFor(() => {
      expect(configActions.saveHistoryPrompt).toHaveBeenCalledWith(
        'Global prompt\n\nRepo prompt\n\nTest prompt'
      );
    });
  });
});
