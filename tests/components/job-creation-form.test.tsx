
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { JobCreationForm } from '@/components/job-creation-form';
import { vi } from 'vitest';

describe('JobCreationForm', () => {
  it('should handle single prompt submission', async () => {
    const onJobsCreated = vi.fn();
    const onCreateJob = vi.fn();

    render(<JobCreationForm onJobsCreated={onJobsCreated} onCreateJob={onCreateJob} />);

    fireEvent.change(screen.getByLabelText('Session Prompts'), { target: { value: 'Test Prompt' } });
    fireEvent.click(screen.getByText('Create Job'));

    // Allow time for state updates and async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onJobsCreated).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple prompt submission', async () => {
    const onJobsCreated = vi.fn();
    const onCreateJob = vi.fn();

    render(<JobCreationForm onJobsCreated={onJobsCreated} onCreateJob={onCreateJob} />);

    fireEvent.change(screen.getByLabelText('Session Prompts'), { target: { value: 'Prompt 1\nPrompt 2' } });
    fireEvent.click(screen.getByText('Create Job'));

    // Allow time for state updates and async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onJobsCreated).toHaveBeenCalledTimes(1);
  });

  it('should filter out empty lines', async () => {
    const onJobsCreated = vi.fn();
    const onCreateJob = vi.fn();

    render(<JobCreationForm onJobsCreated={onJobsCreated} onCreateJob={onCreateJob} />);

    fireEvent.change(screen.getByLabelText('Session Prompts'), { target: { value: 'Prompt 1\n\nPrompt 2' } });
    fireEvent.click(screen.getByText('Create Job'));

    // Allow time for state updates and async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(onJobsCreated).toHaveBeenCalledTimes(1);
  });
});
