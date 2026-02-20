
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyButton } from './copy-button';
import { vi, describe, it, expect } from 'vitest';

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('CopyButton', () => {
  it('renders correctly', () => {
    render(<CopyButton value="test value" label="Copy Test" />);
    expect(screen.getByLabelText('Copy Test')).toBeDefined();
  });

  it('copies text to clipboard when clicked', async () => {
    render(<CopyButton value="test value" label="Copy Test" />);

    const button = screen.getByLabelText('Copy Test');
    fireEvent.click(button);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test value');

    await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            title: "Copied!",
        }));
    });
  });
});
