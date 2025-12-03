
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewJobDialog } from '@/components/new-job-dialog';
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

describe('NewJobDialog', () => {
  beforeEach(() => {
    (useLocalStorage as jest.Mock).mockReturnValue([[], vi.fn()]);
    (useEnv as jest.Mock).mockReturnValue({ julesApiKey: 'test-api-key' });
  });

  it('should render the dialog with a trigger button', () => {
    render(
      <NewJobDialog>
        <button>New Job</button>
      </NewJobDialog>
    );

    expect(screen.getByRole('button', { name: 'New Job' })).toBeInTheDocument();
  });

  it('should open the dialog when the trigger is clicked', () => {
    render(
      <NewJobDialog>
        <button>New Job</button>
      </NewJobDialog>
    );

    fireEvent.click(screen.getByRole('button', { name: 'New Job' }));

    expect(screen.getByRole('heading', { name: 'Create a New Job' })).toBeInTheDocument();
  });
});
