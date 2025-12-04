
import React from 'react';
import { render } from '@testing-library/react';
import { JobCreationForm } from '@/components/job-creation-form';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('@/app/config/actions', () => ({
  getPredefinedPrompts: () => Promise.resolve([]),
  getGlobalPrompt: () => Promise.resolve(''),
  getHistoryPrompts: () => Promise.resolve([]),
  getSettings: () => Promise.resolve(null),
  getRepoPrompt: () => Promise.resolve(''),
  addJob: () => Promise.resolve(),
  saveHistoryPrompt: () => Promise.resolve(),
}));

describe('JobCreationForm', () => {
  it('should render the reset button when showResetButton is true', () => {
    const { getByTestId } = render(
      <JobCreationForm
        showResetButton={true}
        onJobsCreated={() => {}}
        onCreateJob={() => Promise.resolve(null)}
      />
    );
    expect(getByTestId('reset-button')).toBeInTheDocument();
  });

  it('should not render the reset button when showResetButton is false', () => {
    const { queryByTestId } = render(
      <JobCreationForm
        showResetButton={false}
        onJobsCreated={() => {}}
        onCreateJob={() => Promise.resolve(null)}
      />
    );
    expect(queryByTestId('reset-button')).not.toBeInTheDocument();
  });
});
