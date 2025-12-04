
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CronJobHistoryDialog } from '@/components/cron-job-history-dialog';
import { expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

const mockCronJob = {
    id: 'cron-1',
    name: 'Test Cron Job',
    schedule: '* * * * *',
    prompt: 'Test Prompt',
    repo: 'test/repo',
    branch: 'main',
    createdAt: new Date().toISOString(),
    enabled: true,
};

it('should render the dialog and fetch history', async () => {
    render(<CronJobHistoryDialog cronJob={mockCronJob} />);
    fireEvent.click(screen.getByText('View History'));
    expect(screen.getByText('History for Test Cron Job')).toBeInTheDocument();
});
