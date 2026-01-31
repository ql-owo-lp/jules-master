
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ProfilesSettings } from '@/components/profiles-settings';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';

// Mock dependencies
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock AlertDialog components since they use Radix primitives which might need setup
// But usually for simple interactions, rendering them is fine if environment is set up.
// However, Radix portals can be tricky in JSDOM. Let's see if we can use them directly first.
// If not, we might need to mock them or configure test environment.
// For now, let's assume standard setup.

global.fetch = vi.fn();

describe('ProfilesSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ([
                { id: 'default', name: 'Default Profile', createdAt: new Date().toISOString() },
                { id: 'profile-1', name: 'Work Profile', createdAt: new Date().toISOString() }
            ]),
        });
    });

    it('should render profiles and allow deletion with confirmation', async () => {
        const user = userEvent.setup();
        const onProfileSelect = vi.fn();

        render(<ProfilesSettings currentProfileId="default" onProfileSelect={onProfileSelect} />);

        // Wait for profiles to load
        await waitFor(() => {
            expect(screen.getByText('Default Profile')).toBeInTheDocument();
            expect(screen.getByText('Work Profile')).toBeInTheDocument();
        });

        // Find the delete button for the Work Profile
        // The default profile should have disabled delete button
        const deleteButtons = screen.getAllByRole('button', { name: /delete profile/i });
        expect(deleteButtons).toHaveLength(2);

        // The first one is likely default (based on order in mock), but let's check strict accessibility labels
        const deleteWorkProfileBtn = screen.getByRole('button', { name: 'Delete profile Work Profile' });

        // Click delete
        await user.click(deleteWorkProfileBtn);

        // Expect confirmation dialog
        expect(screen.getByText('Are you absolutely sure?')).toBeInTheDocument();
        expect(screen.getByText('This action cannot be undone. This will permanently delete the profile and all its associated settings.')).toBeInTheDocument();

        // Click Cancel
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        // Dialog should disappear (or at least logic shouldn't trigger delete)
        await waitFor(() => {
            expect(screen.queryByText('Are you absolutely sure?')).not.toBeInTheDocument();
        });
        expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('DELETE'), expect.any(Object));

        // Click delete again
        await user.click(deleteWorkProfileBtn);

        // Mock successful delete
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
        });

        // Click Confirm Delete
        const confirmDeleteBtn = screen.getByRole('button', { name: 'Delete' });
        await user.click(confirmDeleteBtn);

        // Verify API call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/profiles?id=profile-1', expect.objectContaining({
                method: 'DELETE'
            }));
        });
    });
});
