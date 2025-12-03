
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('persists the message when the dialog is closed and reopened', () => {
    const handleSendMessage = vi.fn();
    render(
      <MessageDialog
        trigger={trigger}
        storageKey="test-message"
        onSendMessage={handleSendMessage}
      />
    );

    // Open the dialog
    fireEvent.click(screen.getByText('Open Dialog'));

    // Check if the dialog is open
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Type a message
    const textarea = screen.getByPlaceholderText('Type your message here...');
    fireEvent.change(textarea, { target: { value: 'Hello, World!' } });
    expect(textarea.value).toBe('Hello, World!');

    // Close the dialog
    fireEvent.click(screen.getByText('Cancel'));

    // Reopen the dialog
    fireEvent.click(screen.getByText('Open Dialog'));

    // Check if the message is persisted
    expect(textarea.value).toBe('Hello, World!');
  });
});
