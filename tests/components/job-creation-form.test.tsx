
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { JobCreationForm } from '@/components/job-creation-form';
import { vi, describe, it, expect } from 'vitest';

describe('JobCreationForm', () => {
  it('should clear the job name when a history prompt is selected', () => {
    const onJobsCreated = vi.fn();
    const onCreateJob = vi.fn();

    render(
      <JobCreationForm
        onJobsCreated={onJobsCreated}
        onCreateJob={onCreateJob}
      />
    );

    // Set an initial job name
    const jobNameInput = screen.getByLabelText('Job Name (Optional)');
    fireEvent.change(jobNameInput, { target: { value: 'My Awesome Job' } });

    // Select a history prompt
    const promptCombobox = screen.getByPlaceholderText('Select a message suggestion...');
    fireEvent.click(promptCombobox);
    const historyPrompt = screen.getByTestId('combobox-option-history-1');
    fireEvent.click(historyPrompt);

    // Assert that the job name is cleared
    expect(jobNameInput.value).toBe('');
  });
});
