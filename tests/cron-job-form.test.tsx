
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { CronJobForm } from '../src/components/cron-job-form';
import { getPredefinedPrompts, getHistoryPrompts } from '../src/app/config/actions';
import { vi } from 'vitest';

vi.mock('../src/app/config/actions', () => ({
  getPredefinedPrompts: vi.fn(),
  getGlobalPrompt: vi.fn(),
  getRepoPrompt: vi.fn(),
  getHistoryPrompts: vi.fn(),
}));

describe('CronJobForm', () => {
  beforeEach(() => {
    (getPredefinedPrompts as vi.Mock).mockResolvedValue([
      { id: '1', title: 'Test Prompt', prompt: 'This is a test prompt' },
    ]);
    (getHistoryPrompts as vi.Mock).mockResolvedValue([]);
  });

  it('should reset selectedPromptId when the prompt is cleared', async () => {
    render(<CronJobForm onCronJobCreated={() => {}} onCancel={() => {}} />);

    // Wait for prompts to load
    await screen.findByText('Select a message suggestion...');

    // Select a predefined prompt
    fireEvent.click(screen.getByText('Select a message suggestion...'));
    fireEvent.click(screen.getByText('Test Prompt'));

    // Check that the prompt is set
    const promptTextarea = screen.getByLabelText('Prompt') as HTMLTextAreaElement;
    expect(promptTextarea.value).toBe('This is a test prompt');

    // Clear the prompt
    const clearButton = screen.getByRole('button', { name: 'Clear prompt' });
    fireEvent.click(clearButton);

    // Check that the prompt is cleared
    expect(promptTextarea.value).toBe('');

    // Check that the combobox is reset
    expect(screen.getByText('Select a message suggestion...')).toBeInTheDocument();
  });
});
