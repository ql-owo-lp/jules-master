import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react';
import { CronJobForm } from '@/components/cron-job-form';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { useLocalStorage } from "@/hooks/use-local-storage";
import { getPredefinedPrompts, getGlobalPrompt, getRepoPrompt, getHistoryPrompts } from "@/app/config/actions";
import { listSources, refreshSources } from '@/app/sessions/actions';

// Mock dependencies
vi.mock('@/app/config/actions');
vi.mock('@/app/sessions/actions');
vi.mock('@/hooks/use-local-storage');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const mockedUseLocalStorage = useLocalStorage as Mock;

describe('CronJobForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockedUseLocalStorage.mockImplementation((key, defaultValue) => {
             return [defaultValue, vi.fn()];
        });
        (getPredefinedPrompts as Mock).mockResolvedValue([]);
        (getGlobalPrompt as Mock).mockResolvedValue('');
        (getHistoryPrompts as Mock).mockResolvedValue([]);
        (getRepoPrompt as Mock).mockResolvedValue('');
        (listSources as Mock).mockResolvedValue([]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders the form', async () => {
        render(<CronJobForm onCronJobCreated={vi.fn()} onCancel={vi.fn()} />);
        await waitFor(() => {
            expect(screen.getByLabelText('Job Name')).toBeInTheDocument();
            expect(screen.getByLabelText('Schedule (Cron Expression)')).toBeInTheDocument();
        });
    });

    it('shows error for invalid cron expression', async () => {
        render(<CronJobForm onCronJobCreated={vi.fn()} onCancel={vi.fn()} />);
        const scheduleInput = screen.getByLabelText('Schedule (Cron Expression)');

        // Wrap in act because it triggers state update
        await act(async () => {
            fireEvent.change(scheduleInput, { target: { value: 'invalid cron' } });
        });

        await waitFor(() => {
             expect(screen.getByText('Invalid cron expression')).toBeInTheDocument();
        });
    });

    it('shows next run time for valid cron expression', async () => {
        render(<CronJobForm onCronJobCreated={vi.fn()} onCancel={vi.fn()} />);
        const scheduleInput = screen.getByLabelText('Schedule (Cron Expression)');

        await act(async () => {
            fireEvent.change(scheduleInput, { target: { value: '0 0 * * *' } });
        });

        await waitFor(() => {
             expect(screen.getByText(/Next run:/)).toBeInTheDocument();
             expect(screen.queryByText('Invalid cron expression')).not.toBeInTheDocument();
        });
    });
});
