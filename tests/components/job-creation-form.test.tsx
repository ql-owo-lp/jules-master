import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { JobCreationForm } from '@/components/job-creation-form';
import { addJob, getPredefinedPrompts, getGlobalPrompt, getHistoryPrompts, getSettings, saveHistoryPrompt } from '@/app/config/actions';
import { listSources, refreshSources } from '@/app/sessions/actions';
import { useLocalStorage } from "@/hooks/use-local-storage";
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Job } from '@/lib/types';

// Mock entire modules to prevent original implementations from running
vi.mock('@/app/config/actions');
vi.mock('@/app/sessions/actions');

// Mock hooks and other dependencies
vi.mock('@/hooks/use-local-storage');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/components/env-provider', () => ({
  useEnv: () => ({ julesApiKey: 'test-key' }),
}));

const mockedUseLocalStorage = useLocalStorage as Mock;

describe('JobCreationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    mockedUseLocalStorage.mockImplementation((key, defaultValue) => {
      if (key === 'jules-sources-last-fetch') return [now, vi.fn()];
      if (key === 'jules-last-source') return [{ name: 'test-source', githubRepo: { owner: 'test', repo: 'test', defaultBranch: { displayName: 'main' }, branches: [{ displayName: 'main' }] } }, vi.fn()];
      if (key === 'jules-last-branch') return ['main', vi.fn()];
      return [defaultValue, vi.fn()];
    });

    // Setup mocks for the imported actions
    (getPredefinedPrompts as Mock).mockResolvedValue([]);
    (getGlobalPrompt as Mock).mockResolvedValue('');
    (getHistoryPrompts as Mock).mockResolvedValue([]);
    (getSettings as Mock).mockResolvedValue(null);
    (saveHistoryPrompt as Mock).mockResolvedValue(undefined);
    (listSources as Mock).mockResolvedValue([]);
    (refreshSources as Mock).mockResolvedValue(undefined);
    (addJob as Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a background job with all the required properties', async () => {
    const onJobsCreated = vi.fn();
    const onCreateJob = vi.fn();

    mockedUseLocalStorage.mockImplementation((key, defaultValue) => {
      if (key === 'jules-new-job-background') return [true, vi.fn()];
      if (key === 'jules-last-source') return [{ name: 'test-source', githubRepo: { owner: 'test', repo: 'test', defaultBranch: { displayName: 'main' }, branches: [{ displayName: 'main' }] } }, vi.fn()];
      if (key === 'jules-last-branch') return ['main', vi.fn()];
      if (key === 'jules-sources-last-fetch') return [Date.now(), vi.fn()];
      return [defaultValue, vi.fn()];
    });

    render(<JobCreationForm onJobsCreated={onJobsCreated} onCreateJob={onCreateJob} />);
    await screen.findByLabelText('Prompt');

    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'Test background job prompt' } });
    fireEvent.change(screen.getByLabelText('Job Name (Optional)'), { target: { value: 'Test BG Job' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Job/i }));

    await waitFor(() => {
      expect(addJob).toHaveBeenCalledTimes(1);
      const jobPayload = (addJob as Mock).mock.calls[0][0] as Job;
      expect(jobPayload).toMatchObject({
        name: 'Test BG Job',
        prompt: 'Test background job prompt',
        status: 'PENDING',
        background: true,
      });
    });
  });

  it('should create a foreground job with all the required properties', async () => {
    const onJobsCreated = vi.fn();
    const onCreateJob = vi.fn().mockResolvedValue({ id: 'session-123' });

    mockedUseLocalStorage.mockImplementation((key, defaultValue) => {
      if (key === 'jules-new-job-background') return [false, vi.fn()];
      if (key === 'jules-last-source') return [{ name: 'test-source', githubRepo: { owner: 'test', repo: 'test', defaultBranch: { displayName: 'main' }, branches: [{ displayName: 'main' }] } }, vi.fn()];
      if (key === 'jules-last-branch') return ['main', vi.fn()];
      if (key === 'jules-sources-last-fetch') return [Date.now(), vi.fn()];
      return [defaultValue, vi.fn()];
    });

    render(<JobCreationForm onJobsCreated={onJobsCreated} onCreateJob={onCreateJob} />);
    await screen.findByLabelText('Prompt');

    fireEvent.change(screen.getByLabelText('Prompt'), { target: { value: 'Test foreground job prompt' } });
    fireEvent.change(screen.getByLabelText('Job Name (Optional)'), { target: { value: 'Test FG Job' } });
    fireEvent.change(screen.getByLabelText('Number of sessions'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Number of sessions'), { target: { value: '2' } });

    // Toggle background job to false (defaults to true)
    fireEvent.click(screen.getByLabelText('Background Job'));

    fireEvent.click(screen.getByRole('button', { name: /Create Job/i }));

    await waitFor(() => {
      expect(addJob).toHaveBeenCalledTimes(1);
      const jobPayload = (addJob as Mock).mock.calls[0][0] as Job;
      expect(jobPayload).toMatchObject({
        name: 'Test FG Job',
        prompt: 'Test foreground job prompt',
        status: 'COMPLETED',
        background: false,
        sessionCount: 2,
        automationMode: 'AUTO_CREATE_PR',
        requirePlanApproval: false,
      });
    }, { timeout: 2000 }); // Increased timeout
  });
});
