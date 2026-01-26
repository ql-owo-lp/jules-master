import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CronJobForm } from '@/components/cron-job-form';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { useLocalStorage } from "@/hooks/use-local-storage";

// Mock entire modules
vi.mock('@/app/config/actions', () => ({
  getPredefinedPrompts: vi.fn().mockResolvedValue([]),
  getGlobalPrompt: vi.fn().mockResolvedValue(''),
  getHistoryPrompts: vi.fn().mockResolvedValue([]),
  getRepoPrompt: vi.fn().mockResolvedValue(''),
}));
vi.mock('@/app/sessions/actions', () => ({
  listSources: vi.fn().mockResolvedValue([]),
  refreshSources: vi.fn(),
}));
vi.mock('@/hooks/use-local-storage');
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock ResizeObserver for Radix UI
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock ScrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock hasPointerCapture for Radix Select
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.setPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();


const mockedUseLocalStorage = useLocalStorage as Mock;

describe('CronJobForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
     mockedUseLocalStorage.mockImplementation((key, defaultValue) => {
      return [defaultValue, vi.fn()];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates schedule when a preset is selected', async () => {
    const user = userEvent.setup();
    const onCronJobCreated = vi.fn();
    const onCancel = vi.fn();

    render(<CronJobForm onCronJobCreated={onCronJobCreated} onCancel={onCancel} />);

    const scheduleInput = screen.getByRole('textbox', { name: /Schedule/i });
    expect(scheduleInput).toHaveValue('0 * * * *');

    // Trigger has aria-label "Schedule Presets"
    const trigger = screen.getByRole('combobox', { name: /Schedule Presets/i });
    expect(trigger).toHaveTextContent('Every Hour');

    // Open the dropdown
    fireEvent.click(trigger);

    // Select "Every Day"
    const dailyOption = await screen.findByRole('option', { name: 'Every Day' });
    // Use fireEvent to bypass potential pointer-events issues in JSDOM/Radix
    fireEvent.click(dailyOption);

    // Check if input value updated
    await waitFor(() => {
        expect(scheduleInput).toHaveValue('0 0 * * *');
    });

    // Check if trigger text updated
    expect(trigger).toHaveTextContent('Every Day');
  });

  it('updates select value when input is manually changed to a known preset', async () => {
      const user = userEvent.setup();
      const onCronJobCreated = vi.fn();
      const onCancel = vi.fn();
      render(<CronJobForm onCronJobCreated={onCronJobCreated} onCancel={onCancel} />);

      const scheduleInput = screen.getByRole('textbox', { name: /Schedule/i });

      // Change to "Every Week" value manually: "0 0 * * 0"
      await user.clear(scheduleInput);
      await user.type(scheduleInput, '0 0 * * 0');

      const trigger = screen.getByRole('combobox', { name: /Schedule Presets/i });
      await waitFor(() => {
          expect(trigger).toHaveTextContent('Every Week');
      });
  });

  it('shows placeholder or fallback when input is custom', async () => {
      const user = userEvent.setup();
      const onCronJobCreated = vi.fn();
      const onCancel = vi.fn();
      render(<CronJobForm onCronJobCreated={onCronJobCreated} onCancel={onCancel} />);

      const scheduleInput = screen.getByRole('textbox', { name: /Schedule/i });

      // Change to custom value
      await user.clear(scheduleInput);
      await user.type(scheduleInput, '1 2 3 4 5');

      const trigger = screen.getByRole('combobox', { name: /Schedule Presets/i });
      await waitFor(() => {
           expect(trigger).toHaveTextContent('Presets');
      });
  });

  it('shows error message for invalid cron expression', async () => {
    const user = userEvent.setup();
    const onCronJobCreated = vi.fn();
    const onCancel = vi.fn();
    render(<CronJobForm onCronJobCreated={onCronJobCreated} onCancel={onCancel} />);

    const scheduleInput = screen.getByRole('textbox', { name: /Schedule/i });

    // Type invalid cron
    await user.clear(scheduleInput);
    await user.type(scheduleInput, 'invalid cron');

    await waitFor(() => {
      expect(screen.getByText('Invalid cron expression')).toBeInTheDocument();
    });

    // Type valid cron
    await user.clear(scheduleInput);
    await user.type(scheduleInput, '0 0 * * *');

    await waitFor(() => {
      expect(screen.queryByText('Invalid cron expression')).not.toBeInTheDocument();
      expect(screen.getByText(/Next run:/)).toBeInTheDocument();
    });
  });

  it('should HAVE asterisks on required labels', async () => {
    const onCronJobCreated = vi.fn();
    const onCancel = vi.fn();

    render(<CronJobForm onCronJobCreated={onCronJobCreated} onCancel={onCancel} />);

    // Check Job Name label
    const nameLabel = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'label' && content.startsWith('Job Name');
    });
    expect(nameLabel.innerHTML).toContain('*');

    // Check Schedule label
    const scheduleLabel = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'label' && content.startsWith('Schedule');
    });
    expect(scheduleLabel.innerHTML).toContain('*');

    // Check Prompt label
    const promptLabel = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'label' && content.trim().startsWith('Prompt');
    });
    expect(promptLabel.innerHTML).toContain('*');

    // Check Repository label
    const repoLabel = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'label' && content.startsWith('Repository');
    });
    expect(repoLabel.innerHTML).toContain('*');

    // Check required attribute on prompt textarea
    const promptTextarea = screen.getByRole('textbox', { name: /Prompt/i });
    expect(promptTextarea).toHaveAttribute('required');
  });
});
