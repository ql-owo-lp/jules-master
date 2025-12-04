
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '@/app/settings/page';
import { vi } from 'vitest';
import * as configActions from '@/app/config/actions';
import * as sessionsActions from '@/app/sessions/actions';

// Mock entire modules
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('@/components/env-provider', () => ({
  useEnv: vi.fn(() => ({ julesApiKey: 'test-api-key', githubToken: '' })),
}));

vi.mock('@/app/config/actions');
vi.mock('@/app/sessions/actions');

vi.mock('@/components/source-selection', () => ({
    SourceSelection: () => <div data-testid="mock-source-selection" />
}));

describe('SettingsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        const mockedConfig = vi.mocked(configActions);
        mockedConfig.getPredefinedPrompts.mockResolvedValue([]);
        mockedConfig.savePredefinedPrompts.mockResolvedValue();
        mockedConfig.getQuickReplies.mockResolvedValue([]);
        mockedConfig.saveQuickReplies.mockResolvedValue();
        mockedConfig.getGlobalPrompt.mockResolvedValue('');
        mockedConfig.saveGlobalPrompt.mockResolvedValue();
        mockedConfig.getRepoPrompt.mockResolvedValue('');
        mockedConfig.saveRepoPrompt.mockResolvedValue();

        const mockedSessions = vi.mocked(sessionsActions);
        mockedSessions.listSources.mockResolvedValue([]);
        mockedSessions.refreshSources.mockResolvedValue();

        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ idlePollInterval: 120, activePollInterval: 30 }),
            })
        ) as any;
    });

  it('should generate a UUID when adding a new message', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    // Wait for the main component to render after client-side check
    const messagesTab = await screen.findByRole('tab', { name: /Messages/i });
    await user.click(messagesTab);

    // Wait for the tab content to load and be visible by looking for its heading
    const addNewButtons = await screen.findAllByRole('button', { name: /Add New/i })
    await user.click(addNewButtons[0]); // First one is for "Predefined Messages"

    // Dialog appears, fill it out
    const titleInput = await screen.findByLabelText('Title');
    await user.type(titleInput, 'Test Title');

    const contentInput = screen.getByLabelText('Content');
    await user.type(contentInput, 'Test Content');

    // Click save in the dialog
    const saveButton = screen.getByRole('button', { name: 'Save' });
    await user.click(saveButton);

    // Assert that the save action was called with correct, generated data
    await waitFor(() => {
        expect(configActions.savePredefinedPrompts).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
              title: 'Test Title',
              prompt: 'Test Content',
            }),
          ])
        );
    });
  });
});
