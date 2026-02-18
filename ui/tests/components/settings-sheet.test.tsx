
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsSheet } from '@/components/settings-sheet';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mocks
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockSetTheme = vi.fn();
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: mockSetTheme }),
}));

// ResizeObserver mock needed for Radix UI
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SettingsSheet', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('opens, saves settings with loading state, and closes on success', async () => {
    // Default success for all calls
    mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
    });

    render(<SettingsSheet />);

    // Open sheet
    const trigger = screen.getByRole('button', { name: /open settings/i });
    fireEvent.click(trigger);

    // Wait for content
    await waitFor(() => {
        expect(screen.getByText('Quick Settings')).toBeInTheDocument();
    });

    // Click save
    const saveButton = screen.getByRole('button', { name: /save preference/i });
    fireEvent.click(saveButton);

    // Check toast
    await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            title: "Settings saved",
        }));
    });

    // Sheet should be closed
    await waitFor(() => {
        expect(screen.queryByText('Quick Settings')).not.toBeInTheDocument();
    });
  });

  it('shows error toast on failure and keeps sheet open', async () => {
     mockFetch.mockImplementation(async (url: string, options: any) => {
        // If it's the POST request, fail
        if (options && options.method === 'POST') {
            return { ok: false, status: 500 };
        }
        // GET requests succeed
        return {
            ok: true,
            json: async () => ({})
        };
    });

    render(<SettingsSheet />);

    // Open sheet
    fireEvent.click(screen.getByRole('button', { name: /open settings/i }));

    await waitFor(() => {
        expect(screen.getByText('Quick Settings')).toBeInTheDocument();
    });

    // Click save
    const saveButton = screen.getByRole('button', { name: /save preference/i });
    fireEvent.click(saveButton);

    // Check toast
    await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            variant: "destructive",
            title: "Error",
        }));
    });

    // Sheet should still be open
    expect(screen.getByText('Quick Settings')).toBeVisible();
    expect(saveButton).not.toBeDisabled();
  });
});
