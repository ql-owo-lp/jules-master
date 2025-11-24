
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { PrStatus } from '@/components/pr-status';
import * as githubActions from '@/app/github/actions';
import { EnvProvider } from '@/components/env-provider';

vi.mock('@/app/github/actions', () => ({
  getPullRequestStatus: vi.fn(),
}));

describe('PrStatus', () => {
  const prUrl = 'https://github.com/owner/repo/pull/1';

  beforeAll(() => {
    // Mock localStorage
    const localStorageMock = (() => {
      let store: { [key: string]: string } = {};
      return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
          store[key] = value.toString();
        },
        clear: () => {
          store = {};
        },
        removeItem: (key: string) => {
          delete store[key];
        },
      };
    })();

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render a skeleton while loading', async () => {
    (githubActions.getPullRequestStatus as vi.Mock).mockReturnValue(new Promise(() => {}));

    await act(async () => {
        render(
        <EnvProvider>
            <PrStatus prUrl={prUrl} />
        </EnvProvider>
        );
    });

    expect(screen.getByLabelText('Loading PR status')).toBeInTheDocument();
  });

  it('should render the correct icon for a merged PR', async () => {
    (githubActions.getPullRequestStatus as vi.Mock).mockResolvedValue({ state: 'MERGED' });

    await act(async () => {
        render(
        <EnvProvider>
            <PrStatus prUrl={prUrl} />
        </EnvProvider>
        );
    });

    expect(screen.getByLabelText('Pull Request Merged')).toBeInTheDocument();
  });

  it('should render the correct icon for an open PR with successful checks', async () => {
    (githubActions.getPullRequestStatus as vi.Mock).mockResolvedValue({
      state: 'OPEN',
      checks: { status: 'success', passed: 1, total: 1, runs: [] },
    });

    await act(async () => {
        render(
        <EnvProvider>
            <PrStatus prUrl={prUrl} />
        </EnvProvider>
        );
    });

    expect(screen.getByLabelText('PR Open: 1/1 checks passed')).toBeInTheDocument();
  });
});
