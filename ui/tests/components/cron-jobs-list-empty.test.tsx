import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { CronJobsList } from '@/components/cron-jobs-list';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

// Mock dependencies
// We need to mock CronJobDialog to render children so we can see the button
vi.mock('@/components/cron-job-dialog', () => ({
  CronJobDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('CronJobsList Empty State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty state with actionable button when no jobs exist', async () => {
    // Mock successful fetch returning empty array
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<CronJobsList />);

    // Wait for loading to finish
    await waitFor(() => {
        expect(screen.queryByText('No cron jobs yet')).toBeInTheDocument();
    });

    // Check for the new text
    expect(screen.getByText('Schedule your first job to run automatically.')).toBeInTheDocument();

    // Check for the button
    // Note: The icon text might be "Create Cron Job" if the icon is hidden or treated as decorative
    // But since we use <Plus /> icon which might render an svg, user-event might see text.
    // The button text is " Create Cron Job" (with space due to icon)
    const createButton = screen.getByRole('button', { name: /Create Cron Job/i });
    expect(createButton).toBeInTheDocument();
  });
});
