
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { JobCreationForm } from '@/components/job-creation-form';
import { vi } from 'vitest';
import * as configActions from '@/app/config/actions';

// Mock the actions
vi.mock('@/app/config/actions', () => ({
  getPredefinedPrompts: vi.fn().mockResolvedValue([]),
  getGlobalPrompt: vi.fn().mockResolvedValue('Global Prompt'),
  getRepoPrompt: vi.fn().mockResolvedValue(''),
  addJob: vi.fn().mockResolvedValue(undefined),
  getHistoryPrompts: vi.fn().mockResolvedValue([]),
  saveHistoryPrompt: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue(null),
}));

// Mock the useEnv hook
vi.mock('@/components/env-provider', () => ({
    useEnv: () => ({
        julesApiKey: 'test-api-key',
    }),
}));

// Mock useRouter
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}));

describe('JobCreationForm', () => {
  it('should enable the "Create Job" button when the prompt is empty but a global prompt is present', async () => {
    render(
        <JobCreationForm
            onJobsCreated={() => {}}
            onCreateJob={() => Promise.resolve(null)}
        />
    );

    // Wait for the global prompt to be loaded
    await waitFor(() => {
        expect(configActions.getGlobalPrompt).toHaveBeenCalled();
    });

    // The button should be enabled
    const createButton = screen.getByRole('button', { name: /Create Job/i });
    expect(createButton).not.toBeDisabled();
  });
});
