
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { PollCountdown } from './poll-countdown';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('PollCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when pollInterval is 0', () => {
    const { container } = render(<PollCountdown pollInterval={0} lastUpdatedAt={new Date()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when lastUpdatedAt is null', () => {
    const { container } = render(<PollCountdown pollInterval={60} lastUpdatedAt={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders correct initial time', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const lastUpdatedAt = new Date(now - 10000); // 10 seconds ago
    const pollInterval = 60;

    render(<PollCountdown pollInterval={pollInterval} lastUpdatedAt={lastUpdatedAt} />);

    // Remaining = 60 - 10 = 50
    expect(screen.getByText('Next poll in: 50s')).toBeDefined();
  });

  it('updates time every second', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const lastUpdatedAt = new Date(now); // Just updated
    const pollInterval = 60;

    render(<PollCountdown pollInterval={pollInterval} lastUpdatedAt={lastUpdatedAt} />);

    expect(screen.getByText('Next poll in: 60s')).toBeDefined();

    // Advance 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Next poll in: 59s')).toBeDefined();

    // Advance 10 seconds
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText('Next poll in: 49s')).toBeDefined();
  });

  it('stops at 0', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const lastUpdatedAt = new Date(now);
    const pollInterval = 5;

    render(<PollCountdown pollInterval={pollInterval} lastUpdatedAt={lastUpdatedAt} />);

    act(() => {
      vi.advanceTimersByTime(6000); // 6 seconds
    });

    expect(screen.getByText('Next poll in: 0s')).toBeDefined();
  });

  it('renders correctly with number timestamp', () => {
    const now = Date.now();
    vi.setSystemTime(now);
    const lastUpdatedAt = now - 10000; // 10 seconds ago
    const pollInterval = 60;

    render(<PollCountdown pollInterval={pollInterval} lastUpdatedAt={lastUpdatedAt} />);

    expect(screen.getByText('Next poll in: 50s')).toBeDefined();
  });
});
