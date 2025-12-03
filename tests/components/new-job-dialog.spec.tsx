
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { NewJobDialog } from '@/components/new-job-dialog';
import { useEnv } from '@/components/env-provider';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useToast } from '@/hooks/use-toast';
import { createSession } from '@/app/sessions/new/actions';
import { revalidateSessions } from '@/app/sessions/actions';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@/components/env-provider');
vi.mock('@/hooks/use-local-storage');
vi.mock('@/hooks/use-toast');
vi.mock('@/app/sessions/new/actions');
vi.mock('@/app/sessions/actions');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('NewJobDialog', () => {
  beforeEach(() => {
    (useEnv as jest.Mock).mockReturnValue({ julesApiKey: 'test-api-key' });
    (useLocalStorage as jest.Mock).mockReturnValue([[], vi.fn()]);
    (useToast as jest.Mock).mockReturnValue({ toast: vi.fn() });
    (createSession as jest.Mock).mockResolvedValue({ id: 'test-session-id' });
  });

  it('renders the "Create a New Job" button', () => {
    const { getByText } = render(<NewJobDialog><div>Trigger</div></NewJobDialog>);
    expect(getByText('New Job')).toBeInTheDocument();
  });

  it('opens the dialog when the trigger is clicked', () => {
    const { getByText, getByRole } = render(<NewJobDialog><div>Trigger</div></NewJobDialog>);
    fireEvent.click(getByText('Trigger'));
    expect(getByRole('heading', { name: 'Create a New Job' })).toBeVisible();
  });

  it('calls createSession with the correct parameters when the form is submitted', async () => {
    const { getByText, getByLabelText, getByRole } = render(<NewJobDialog><div>Trigger</div></NewJobDialog>);
    fireEvent.click(getByText('Trigger'));

    fireEvent.change(getByLabelText('Job Name'), { target: { value: 'Test Job' } });
    fireEvent.change(getByRole('textbox', { name: 'Session Prompts' }), { target: { value: 'Test Prompt' } });
    fireEvent.click(getByRole('button', { name: 'Create Job' }));

    await waitFor(() => {
      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Job',
          prompt: 'Test Prompt',
        }),
        'test-api-key'
      );
    });
  });

  it('renders the form directly when isPage is true', () => {
    const { getByRole } = render(<NewJobDialog isPage />);
    expect(getByRole('heading', { name: 'New Job' })).toBeVisible();
  });

  it('pre-fills the form with initialValues', () => {
    const { getByLabelText } = render(
      <NewJobDialog
        initialValues={{
          jobName: 'Initial Job',
          prompt: 'Initial Prompt',
        }}
      />
    );
    fireEvent.click(getByRole('button', { name: 'New Job' }));
    expect(getByLabelText('Job Name')).toHaveValue('Initial Job');
    expect(getByRole('textbox', { name: 'Session Prompts' })).toHaveValue('Initial Prompt');
  });

  it('shows a toast message when createSession fails', async () => {
    (createSession as jest.Mock).mockResolvedValue(null);
    const { getByText, getByRole } = render(<NewJobDialog><div>Trigger</div></NewJobDialog>);
    fireEvent.click(getByText('Trigger'));
    fireEvent.click(getByRole('button', { name: 'Create Job' }));

    await waitFor(() => {
      expect(useToast().toast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'Failed to create session 1',
        description: 'Retrying... (1/3)',
      });
    });
  });
});
