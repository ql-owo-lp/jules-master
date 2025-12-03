
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { JobCreationForm } from '@/components/job-creation-form';
import { vi } from 'vitest';
import type { PredefinedPrompt } from '@/lib/types';

// Mock the actions module
vi.mock('@/app/config/actions', () => ({
  getPredefinedPrompts: vi.fn(),
  getGlobalPrompt: vi.fn().mockResolvedValue(''),
  getRepoPrompt: vi.fn().mockResolvedValue(''),
  getHistoryPrompts: vi.fn().mockResolvedValue([]),
  saveHistoryPrompt: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue(null),
  addJob: vi.fn().mockResolvedValue(undefined),
}));

// Mock the sessions actions module
vi.mock('@/app/sessions/actions', () => ({
    refreshSources: vi.fn().mockResolvedValue(undefined),
    listSources: vi.fn().mockResolvedValue([])
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

import { getPredefinedPrompts } from '@/app/config/actions';

// Mock the use-toast hook
vi.mock('@/hooks/use-toast', () => ({
    useToast: () => ({
        toast: vi.fn(),
    }),
}));

describe('JobCreationForm', () => {
  it('should clear the job name when the prompt is modified after selecting a predefined prompt', async () => {
    const mockPrompts: PredefinedPrompt[] = [
        { id: '1', title: 'Boba App', prompt: 'Create a boba app!' }
    ];
    (getPredefinedPrompts as vi.Mock).mockResolvedValue(mockPrompts);

    await act(async () => {
        render(<JobCreationForm onJobsCreated={() => {}} onCreateJob={async () => null} />);
    });

    const jobNameInput = await screen.findByLabelText('Job Name (Optional)') as HTMLInputElement;
    const promptTextarea = await screen.findByLabelText('Prompt') as HTMLTextAreaElement;
    const predefinedPromptButton = await screen.findByText('Select a message suggestion...');

    // Select a predefined prompt
    fireEvent.click(predefinedPromptButton);

    // Wait for the options to appear
    const option = await screen.findByText('Boba App');
    fireEvent.click(option);

    // Verify that the job name and prompt are set
    await waitFor(() => {
        expect(jobNameInput.value).toBe('Boba App');
        expect(promptTextarea.value).toBe('Create a boba app!');
    });

    // Modify the prompt
    fireEvent.change(promptTextarea, { target: { value: 'Create a new app!' } });

    // Verify that the job name is cleared
    expect(jobNameInput.value).toBe('');
  });
});
