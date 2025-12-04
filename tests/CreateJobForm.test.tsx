
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { CreateJobForm } from '@/components/ui/create-job-form';
import '@testing-library/jest-dom';

test('renders the create job form and submits a new job', () => {
  const createJob = vi.fn();
  render(<CreateJobForm createJob={createJob} />);

  fireEvent.change(screen.getByPlaceholderText('Enter each prompt on a new line...'), {
    target: { value: 'test prompt' },
  });

  fireEvent.click(screen.getByText('Create Job'));

  expect(createJob).toHaveBeenCalledWith(['test prompt']);
});
