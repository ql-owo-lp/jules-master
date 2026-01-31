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
    await screen.findByRole('textbox', { name: /Session Prompts/i });

    fireEvent.change(screen.getByRole('textbox', { name: /Session Prompts/i }), { target: { value: 'Test background job prompt' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Job Name/i }), { target: { value: 'Test BG Job' } });
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
    await screen.findByRole('textbox', { name: /Session Prompts/i });

    fireEvent.change(screen.getByRole('textbox', { name: /Session Prompts/i }), { target: { value: 'Test foreground job prompt' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Job Name/i }), { target: { value: 'Test FG Job' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /Number of sessions/i }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: /Number of sessions/i }), { target: { value: '2' } });
    
    // Toggle background job to false (defaults to true)
    // Background Job switch usually has role="switch"
    fireEvent.click(screen.getByRole('switch', { name: /Background Job/i }));
    
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

  it('should HAVE asterisks on required labels', async () => {
    const onJobsCreated = vi.fn();
    const onCreateJob = vi.fn();

    render(<JobCreationForm onJobsCreated={onJobsCreated} onCreateJob={onCreateJob} />);
    await screen.findByRole('textbox', { name: /Session Prompts/i });

    // Check Prompt label
    // The label text includes the asterisk, so we look for "Prompt" loosely.
    // Also ensuring it contains the asterisk visually (via span or text content)
    // getByText returns the label element.
    const promptLabel = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'label' && content.startsWith('Prompt');
    });
    expect(promptLabel.innerHTML).toContain('*');

    // Check Repository label
    const repoLabel = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'label' && content.includes('Repository');
    });
    expect(repoLabel.innerHTML).toContain('*');

    // Check Branch label (rendered by BranchSelection)
    const branchLabel = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'label' && content.includes('Branch');
    });
    expect(branchLabel.innerHTML).toContain('*');

    // Check required attribute on prompt textarea
    // getByLabelText might fail if the label text is exactly "Prompt" but now it renders "Prompt *"
    // Testing library often normalizes text but "Prompt *" might be distinct.
    // However, the accessible name usually includes the text.
    // Let's verify if `getByLabelText` works or if we need `getByRole`.
    // The asterisk is inside the label, so the label text is "Prompt *".
    // But `getByLabelText` usually does partial matching or regex if provided.
    // If we use string 'Prompt', it might fail if it's strictly "Prompt *".
    // Let's use regex /Prompt/i

    const promptTextarea = screen.getByRole('textbox', { name: /Prompt/i });
    expect(promptTextarea).toHaveAttribute('required');
  });

  it('should display character count when prompt is entered', async () => {
    const onJobsCreated = vi.fn();
    const onCreateJob = vi.fn();

    render(<JobCreationForm onJobsCreated={onJobsCreated} onCreateJob={onCreateJob} />);
    const textarea = await screen.findByRole('textbox', { name: /Session Prompts/i });

    // Initially, count should not be visible
    expect(screen.queryByText(/chars/)).toBeNull();

    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(await screen.findByText('5 chars')).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'Hello World' } });
    expect(await screen.findByText('11 chars')).toBeInTheDocument();
  });
});
