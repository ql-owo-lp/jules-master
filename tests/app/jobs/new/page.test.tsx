
import React from 'react';
import { render, screen } from '@testing-library/react';
import NewJobPage from '@/app/jobs/new/page';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { vi } from 'vitest';

vi.mock('@/hooks/use-local-storage');
vi.mock('@/components/new-job-dialog', () => ({
  NewJobDialog: () => <div>Create a New Job</div>,
}));

describe('NewJobPage', () => {
  it('should not render NewJobDialog when API key is not set', () => {
    (useLocalStorage as jest.Mock).mockReturnValue(['']);

    render(<NewJobPage />);

    expect(screen.queryByText('Create a New Job')).toBeNull();
  });

  it('should render NewJobDialog when API key is set', () => {
    (useLocalStorage as jest.Mock).mockReturnValue(['fake-api-key']);

    render(<NewJobPage />);

    expect(screen.queryByText('Create a New Job')).toBeDefined();
  });
});
