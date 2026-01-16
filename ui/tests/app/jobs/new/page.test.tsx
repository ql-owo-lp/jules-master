import React from 'react';
import { render, screen } from '@testing-library/react';
import NewJobPage from '@/app/jobs/new/page';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { describe, it, expect, vi, type Mock } from 'vitest';

vi.mock('@/hooks/use-local-storage');
vi.mock('@/components/new-job-dialog', () => ({
  NewJobDialog: () => <div>Create a New Job</div>,
}));

describe('NewJobPage', () => {
  it('should not render NewJobDialog when API key is not set', () => {
    (useLocalStorage as Mock).mockReturnValue(['']);

    render(<NewJobPage />);

    expect(screen.queryByText('Create a New Job')).toBeNull();
  });

  it('should render NewJobDialog when API key is set', () => {
    (useLocalStorage as Mock).mockReturnValue(['fake-api-key']);

    render(<NewJobPage />);

    expect(screen.queryByText('Create a New Job')).toBeDefined();
  });
});
