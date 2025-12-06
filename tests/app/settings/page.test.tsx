
import React from 'react';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '@/app/settings/page';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { vi } from 'vitest';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

// Mock global crypto for consistent UUIDs
global.crypto.randomUUID = vi.fn();

// This object simulates the browser's localStorage.
let stateStore: { [key: string]: any } = {};

// Mock hooks and modules.
vi.mock('@/hooks/use-local-storage', async (importOriginal) => {
    const originalModule = await importOriginal<typeof import('@/hooks/use-local-storage')>();
    return {
        ...originalModule,
        useLocalStorage: vi.fn(),
    };
});
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('next/navigation');
vi.mock('@/components/env-provider', () => ({ useEnv: () => ({}) }));
vi.mock('@/app/config/actions', () => ({
    getPredefinedPrompts: vi.fn().mockResolvedValue([]),
    getQuickReplies: vi.fn().mockResolvedValue([]),
    getGlobalPrompt: vi.fn().mockResolvedValue(''),
}));
vi.mock('@/app/sessions/actions', () => ({ listSources: vi.fn().mockResolvedValue([]) }));

describe('SettingsPage Profile Management', () => {
    const mockUseLocalStorage = useLocalStorage as vi.Mock;
    const mockUseSearchParams = useSearchParams as vi.Mock;
    const mockUseRouter = useRouter as vi.Mock;
    const mockUsePathname = usePathname as vi.Mock;

    beforeEach(() => {
        vi.clearAllMocks();
        stateStore = {
            'jules-profiles': [{ id: 'default', name: 'Default', isEnabled: true }],
            'default-jules-api-key': 'default-api-key',
        };

        mockUseLocalStorage.mockImplementation((key: string, initialValue: any) => {
            const [state, setState] = React.useState(stateStore[key] ?? initialValue);

            const updateState = (value: any) => {
                const newValue = typeof value === 'function' ? value(state) : value;
                // Prevent infinite loops by checking if the value has changed
                if (JSON.stringify(stateStore[key]) !== JSON.stringify(newValue)) {
                    stateStore[key] = newValue;
                    setState(newValue);
                }
            };

            return [state, updateState];
        });

        (crypto.randomUUID as vi.Mock).mockReturnValue('new-profile-uuid');

        // Mock fetch to prevent errors in the test environment
        global.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ theme: 'system' }), // Mock settings response
            })
        ) as vi.Mock;
    });

    afterEach(() => {
        cleanup();
    });

    it('should add, rename, enable, and delete profiles', async () => {
        const user = userEvent.setup();
        const mockRouter = { push: vi.fn() };
        mockUseRouter.mockReturnValue(mockRouter);
        mockUsePathname.mockReturnValue('/settings');

        let currentSearchParams = new URLSearchParams();
        mockUseSearchParams.mockImplementation(() => currentSearchParams);

        const { rerender } = render(<SettingsPage />);

        // Simulate navigating to the 'Profiles' tab
        currentSearchParams = new URLSearchParams('tab=profiles');
        rerender(<SettingsPage />);

        // ADD a new profile
        await user.click(await screen.findByRole('button', { name: /Add New Profile/i }));

        const nameInput = await screen.findByLabelText('Name');
        await user.type(nameInput, 'Test Profile');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        const profileRow = await screen.findByText('Test Profile');
        expect(profileRow).toBeInTheDocument();

        // RENAME the profile
        const profileRowElement = profileRow.closest('tr')!;
        const dropdownTrigger = within(profileRowElement).getByTitle('Open menu');
        await user.click(dropdownTrigger);

        const renameMenuItem = await screen.findByRole('menuitem', { name: /Rename/i });
        await user.click(renameMenuItem);

        const renameInput = await screen.findByLabelText('Name');
        await user.clear(renameInput);
        await user.type(renameInput, 'Renamed Profile');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        const renamedProfileRow = await screen.findByText('Renamed Profile');
        expect(renamedProfileRow).toBeInTheDocument();
        expect(screen.queryByText('Test Profile')).not.toBeInTheDocument();

        // ENABLE the profile
        const renamedProfileRowElement = renamedProfileRow.closest('tr')!;
        const dropdownTrigger2 = within(renamedProfileRowElement).getByTitle('Open menu');
        await user.click(dropdownTrigger2);

        const enableMenuItem = await screen.findByRole('menuitem', { name: /Enable/i });
        await user.click(enableMenuItem);

        await waitFor(() => {
            const enabledText = within(renamedProfileRowElement).getByText('Enabled');
            expect(enabledText).toBeInTheDocument();
        });

        const defaultProfileRow = await screen.findByText('Default');
        const defaultProfileRowElement = defaultProfileRow.closest('tr')!;

        await waitFor(() => {
            const disabledText = within(defaultProfileRowElement).getByText('Disabled');
            expect(disabledText).toBeInTheDocument();
        });

        // DELETE the profile
        const dropdownTrigger3 = within(renamedProfileRowElement).getByTitle('Open menu');
        await user.click(dropdownTrigger3);

        const deleteMenuItem = await screen.findByRole('menuitem', { name: /Delete/i });
        await user.click(deleteMenuItem);

        await waitFor(() => {
            expect(screen.queryByText('Renamed Profile')).not.toBeInTheDocument();
        });
    });
});
