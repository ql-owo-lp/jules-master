
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CronJobsList } from './cron-jobs-list';
import type { CronJob } from '@/lib/types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AlertDialog to avoid Portal issues in JSDOM
vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: any) => open ? <div role="alertdialog">{children}</div> : null,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children }: any) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
}));

const mockCronJobs: CronJob[] = [
  {
    id: '1',
    name: 'Test Job',
    schedule: '0 0 * * *',
    repo: 'owner/repo',
    branch: 'main',
    enabled: true,
    lastRunAt: null,
    prompt: 'test prompt',
    createdAt: new Date().toISOString(),
    autoApproval: true,
  },
];

describe('CronJobsList', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('displays the job name in the delete confirmation dialog', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCronJobs,
    });

    render(<CronJobsList />);

    // Wait for the job to be displayed
    await waitFor(() => {
      expect(screen.getByText('Test Job')).toBeInTheDocument();
    });

    // Find the actions dropdown
    const user = userEvent.setup();
    const actionsButton = screen.getByRole('button', { name: /open menu for test job/i });
    await user.click(actionsButton);

    // Find the delete button in the dropdown
    const deleteButton = await screen.findByText('Delete');
    await user.click(deleteButton);

    // Check if the confirmation dialog contains the job name
    await waitFor(() => {
        const dialog = screen.getByRole('alertdialog');
        expect(dialog).toHaveTextContent(/This will permanently delete the cron job/);
        expect(dialog).toHaveTextContent(/Test Job/);
    });
  });
});
