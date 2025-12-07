
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MessageDialog } from '@/components/message-dialog';
import { Button } from '@/components/ui/button';
import React from 'react';

import { vi } from 'vitest';

vi.mock('@/hooks/use-profile-settings', () => ({
  useProfileSettings: (key: string, initialValue: any) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require('react');
    const [value, setValue] = React.useState(initialValue);
    return [value, setValue];
  },
}));

describe('MessageDialog', () => {
  const trigger = <Button>Open Dialog</Button>;

  it('clears the message when the dialog is closed and reopened', () => {
    const handleSendMessage = vi.fn();
    render(
      <MessageDialog
        trigger={trigger}
        storageKey="test-message"
        onSendMessage={handleSendMessage}
      />
    );

    // Open the dialog
    act(() => {
      fireEvent.click(screen.getByText('Open Dialog'));
    });

    // Check if the dialog is open
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Type a message
    const textarea = screen.getByPlaceholderText('Type your message here...');
    act(() => {
      fireEvent.change(textarea, { target: { value: 'Hello, World!' } });
    });
    expect(textarea.value).toBe('Hello, World!');

    // Close the dialog
    act(() => {
      fireEvent.click(screen.getByText('Cancel'));
    });

    // Reopen the dialog
    act(() => {
      fireEvent.click(screen.getByText('Open Dialog'));
    });

    // Check if the message is cleared
    expect(textarea.value).toBe('');
  });
});
