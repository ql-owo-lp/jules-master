
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageDialog } from '@/components/message-dialog';
import { Button } from '@/components/ui/button';
import React from 'react';
import { vi } from 'vitest';

// Mock useLocalStorage to behave like useState for this test
vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: (key: string, initialValue: any) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require('react');
    return React.useState(initialValue);
  },
}));

describe('MessageDialog', () => {
  const trigger = <Button>Open Dialog</Button>;

  it('clears the message when the dialog is closed and reopened', async () => {
    const user = userEvent.setup();
    const handleSendMessage = vi.fn();
    render(
      <MessageDialog
        trigger={trigger}
        storageKey="test-message"
        onSendMessage={handleSendMessage}
      />
    );

    // Open the dialog
    await user.click(screen.getByText('Open Dialog'));

    // Check if the dialog is open
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Type a message
    const textarea = screen.getByPlaceholderText('Type your message here...');
    await user.type(textarea, 'Hello, World!');
    expect(textarea).toHaveValue('Hello, World!');

    // Close the dialog
    await user.click(screen.getByText('Cancel'));

    // Reopen the dialog
    await user.click(screen.getByText('Open Dialog'));

    // Check if the message is cleared
    expect(textarea).toHaveValue('');
  });
});
