
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { JobCreationForm } from '@/components/job-creation-form';
import { vi } from 'vitest';

// Mock server actions
vi.mock('@/app/sessions/actions', () => ({
  refreshSources: vi.fn(),
  listSources: vi.fn().mockResolvedValue([
    {
      name: 'test-repo',
      githubRepo: {
        owner: 'test-owner',
        repo: 'test-repo',
        branches: [{ displayName: 'main' }],
        defaultBranch: { displayName: 'main' },
      },
    },
  ]),
}));

vi.mock('@/app/config/actions', () => ({
  getPredefinedPrompts: vi.fn().mockResolvedValue([]),
  getGlobalPrompt: vi.fn().mockResolvedValue(''),
  getRepoPrompt: vi.fn().mockResolvedValue(''),
  addJob: vi.fn().mockResolvedValue(undefined),
  getHistoryPrompts: vi.fn().mockResolvedValue([]),
  saveHistoryPrompt: vi.fn().mockResolvedValue(undefined),
}));

// Mock hooks
vi.mock('@/hooks/use-local-storage', () => ({
    useLocalStorage: vi.fn((key, initialValue) => [initialValue, vi.fn()]),
}));

vi.mock('@/hooks/use-toast', () => ({
    useToast: vi.fn(() => ({
        toast: vi.fn(),
    })),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

describe('JobCreationForm', () => {
  it('should enable the "Create Job" button only when all required fields are filled', async () => {
    const { getByText, getByLabelText } = render(
      <JobCreationForm
        onJobsCreated={() => {}}
        onCreateJob={() => Promise.resolve(null)}
      />
    );

    const createJobButton = getByText('Create Job');
    const promptInput = getByLabelText('Prompt');
    const repoSelect = getByLabelText('Repository');
    const branchSelect = getByLabelText('Branch');

    // Initial state: button is disabled
    expect(createJobButton).toBeDisabled();

    // User fills in the prompt
    fireEvent.change(promptInput, { target: { value: 'Test prompt' } });
    expect(createJobButton).toBeDisabled();

    // User selects a repository
    fireEvent.change(repoSelect, { target: { value: 'test-repo' } });
    expect(createJobButton).toBeDisabled();

    // User selects a branch
    fireEvent.change(branchSelect, { target: { value: 'main' } });

    // All required fields are filled, the button should be enabled
    await waitFor(() => {
      expect(createJobButton).toBeEnabled();
    });
  });
});
