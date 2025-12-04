
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { JobCreationForm } from '@/components/job-creation-form';
import '@testing-library/jest-dom';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { vi } from 'vitest';

vi.mock('@/hooks/use-local-storage');
vi.mock('@/components/source-selection', () => ({
  SourceSelection: ({ onSourceSelected, selectedValue }) => (
    <button onClick={() => onSourceSelected({ name: 'Test Source', githubRepo: { owner: 'test', repo: 'test', branches: [{displayName: 'main', sha: '123'}] } })}>
      {selectedValue ? selectedValue.name : 'Select Source'}
    </button>
  ),
}));
vi.mock('@/components/branch-selection', () => ({
  BranchSelection: ({ onBranchSelected, selectedValue }) => (
    <button onClick={() => onBranchSelected('main')}>
      {selectedValue ? selectedValue : 'Select Branch'}
    </button>
  ),
}));

describe('JobCreationForm', () => {
  const mockOnJobsCreated = vi.fn();
  const mockOnCreateJob = vi.fn();
  const mockSetSelectedSource = vi.fn();
  const mockSetSelectedBranch = vi.fn();

  beforeEach(() => {
    (useLocalStorage as jest.Mock).mockImplementation((key, initialValue) => {
      if (key === 'jules-default-session-count') {
        return [10, vi.fn()];
      }
      if (key === 'jules-last-source') {
        return [null, mockSetSelectedSource];
      }
      if (key === 'jules-last-branch') {
        return [undefined, mockSetSelectedBranch];
      }
      return [initialValue, vi.fn()];
    });

    render(
      <JobCreationForm
        onJobsCreated={mockOnJobsCreated}
        onCreateJob={mockOnCreateJob}
        onReset={() => {}}
      />
    );
  });

  it('should reset the form when the reset button is clicked', () => {
    const jobNameInput = screen.getByLabelText('Job Name (Optional)');
    const promptInput = screen.getByLabelText('Prompt');
    const sessionCountInput = screen.getByLabelText('Number of sessions');
    const sourceButton = screen.getByText('Select Source');
    const branchButton = screen.getByText('Select Branch');

    fireEvent.change(jobNameInput, { target: { value: 'Test Job' } });
    fireEvent.change(promptInput, { target: { value: 'Test Prompt' } });
    fireEvent.change(sessionCountInput, { target: { value: '5' } });
    fireEvent.click(sourceButton);
    fireEvent.click(branchButton);

    const resetButton = screen.getByRole('button', { name: 'Reset Form' });
    fireEvent.click(resetButton);

    expect(jobNameInput.value).toBe('');
    expect(promptInput.value).toBe('');
    expect(sessionCountInput.value).toBe('10');
    expect(mockSetSelectedSource).toHaveBeenCalledWith(null);
    expect(mockSetSelectedBranch).toHaveBeenCalledWith(undefined);
  });

  it('should submit the form with the correct values', async () => {
    const promptInput = screen.getByLabelText('Prompt');
    const sourceButton = screen.getByText('Select Source');
    const branchButton = screen.getByText('Select Branch');
    const createJobButton = screen.getByRole('button', { name: 'Create Job' });

    fireEvent.change(promptInput, { target: { value: 'Test Prompt' } });
    fireEvent.click(sourceButton);
    fireEvent.click(branchButton);
    fireEvent.click(createJobButton);

    await waitFor(() => {
      expect(mockOnCreateJob).toHaveBeenCalledWith(
        expect.any(String),
        'Test Prompt',
        { name: 'Test Source', githubRepo: { owner: 'test', repo: 'test', branches: [{displayName: 'main', sha: '123'}] } },
        'main',
        false,
        'AUTO_CREATE_PR'
      );
    });
  });

  it('should not submit the form if the prompt is empty', async () => {
    const createJobButton = screen.getByRole('button', { name: 'Create Job' });
    fireEvent.click(createJobButton);

    await waitFor(() => {
      expect(mockOnCreateJob).not.toHaveBeenCalled();
    });
  });
});
