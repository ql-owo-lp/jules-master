
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { JobCreationForm } from '@/components/job-creation-form';
import { vi } from 'vitest';

// Mocks
vi.mock('@/app/config/actions', () => ({
  getPredefinedPrompts: vi.fn().mockResolvedValue([
    { id: '1', title: 'Test Prompt', prompt: 'This is a test prompt' },
  ]),
  getGlobalPrompt: vi.fn().mockResolvedValue(''),
  getRepoPrompt: vi.fn().mockResolvedValue(''),
  addJob: vi.fn().mockResolvedValue(undefined),
  getHistoryPrompts: vi.fn().mockResolvedValue([]),
    saveHistoryPrompt: vi.fn()
}));

describe('JobCreationForm', () => {
  it('clears the job name when the prompt is edited after selecting a predefined prompt', async () => {
    const { getByLabelText, getByText, getByPlaceholderText } = render(
      <JobCreationForm
        onJobsCreated={() => {}}
        onCreateJob={() => Promise.resolve(null)}
      />
    );

    // Select the predefined prompt
    fireEvent.click(getByText('Select a message suggestion...'));
    await waitFor(() => fireEvent.click(getByText('Test Prompt')));

    // Check that the job name is set
    expect(getByLabelText('Job Name (Optional)').value).toBe('Test Prompt');

    // Edit the prompt
    fireEvent.change(getByPlaceholderText('e.g., Create a boba app!'), {
      target: { value: 'This is a modified prompt' },
    });

    // Check that the job name is cleared
    expect(getByLabelText('Job Name (Optional)').value).toBe('');
  });
});
