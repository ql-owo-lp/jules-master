import React from 'react';
import { render, screen } from '@testing-library/react';
import { ActivityFeed } from './activity-feed';
import type { Activity } from '@/lib/types';
import { vi, describe, it, expect } from 'vitest';

// Mock useLocalStorage
vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: vi.fn(() => [false, vi.fn()]),
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

// Mock ScrollArea
vi.mock('./ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('ActivityFeed', () => {
  const mockActivities: Activity[] = [
    {
      id: '1',
      name: 'activity-1',
      description: 'Agent message',
      createTime: new Date().toISOString(),
      originator: 'agent',
      agentMessaged: { agentMessage: 'Hello' }
    },
    {
      id: '2',
      name: 'activity-2',
      description: 'User message',
      createTime: new Date().toISOString(),
      originator: 'user',
      userMessaged: { userMessage: 'Hi' }
    }
  ];

  it('renders activities', () => {
    render(
      <ActivityFeed
        activities={mockActivities}
        lastUpdatedAt={new Date()}
        onRefresh={() => {}}
        pollInterval={0}
      />
    );

    expect(screen.getByText('Agent message')).toBeInTheDocument();
    expect(screen.getByText('User message')).toBeInTheDocument();
  });

  it('renders originator info with accessible label', () => {
    render(
      <ActivityFeed
        activities={mockActivities}
        lastUpdatedAt={new Date()}
        onRefresh={() => {}}
        pollInterval={0}
      />
    );

    // This should fail initially because currently it uses 'title' attribute, not aria-label
    const agentOriginator = screen.getByLabelText('Originated by: agent');
    expect(agentOriginator).toBeInTheDocument();

    const userOriginator = screen.getByLabelText('Originated by: user');
    expect(userOriginator).toBeInTheDocument();
  });
});
