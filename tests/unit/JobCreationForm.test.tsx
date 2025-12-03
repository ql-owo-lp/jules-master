
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobCreationForm } from '@/components/job-creation-form';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useEnv } from '@/components/env-provider';
import { vi } from 'vitest';

vi.mock('@/hooks/use-local-storage');
vi.mock('@/components/env-provider');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('JobCreationForm', () => {
  beforeEach(() => {
    (useLocalStorage as jest.Mock).mockReturnValue([[], vi.fn()]);
    (useEnv as jest.Mock).mockReturnValue({ julesApiKey: 'test-api-key' });
  });

  it('should render the form with all fields', () => {
    render(<JobCreationForm onJobsCreated={() => {}} onCreateJob={async () => null} />);

    expect(screen.getByLabelText('Job Name (Optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Number of sessions')).toBeInTheDocument();
    expect(screen.getByLabelText('Prompt')).toBeInTheDocument();
    expect(screen.getByLabelText('Repository')).toBeInTheDocument();
    expect(screen.getByLabelText('Branch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Job' })).toBeInTheDocument();
  });
});
