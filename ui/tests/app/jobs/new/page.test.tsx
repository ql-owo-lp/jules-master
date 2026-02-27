
import React from 'react';
import { render, screen } from '@testing-library/react';
import NewJobPage from '@/app/jobs/new/page';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useEnv } from '@/components/env-provider';
import { describe, it, expect, vi, type Mock, beforeEach } from 'vitest';

vi.mock('@/hooks/use-local-storage');
vi.mock('@/components/env-provider');
vi.mock('@/components/new-job-dialog', () => ({
  NewJobDialog: () => <div data-testid="job-dialog">Create a New Job</div>,
}));

describe('NewJobPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useEnv as Mock).mockReturnValue({ hasJulesApiKey: false, hasGithubToken: false });
    (useLocalStorage as Mock).mockImplementation((key, initialValue) => [initialValue, vi.fn()]);
  });

  it('should render API key alert when hasKey is false', async () => {
    (useLocalStorage as Mock).mockReturnValue(['', vi.fn()]);
    (useEnv as Mock).mockReturnValue({ hasJulesApiKey: false });

    render(<NewJobPage />);

    // Use findByText to wait for isClient to become true (via useEffect)
    const alert = await screen.findByText('API Key Not Set');
    expect(alert).toBeDefined();
  });

  it('should render NewJobDialog when apiKey is set in localStorage', async () => {
    (useLocalStorage as Mock).mockImplementation((key) => {
        if (key.startsWith('jules-api-key')) return ['fake-key', vi.fn()];
        return ['default', vi.fn()];
    });

    render(<NewJobPage />);

    expect(await screen.findByTestId('job-dialog')).toBeDefined();
  });

  it('should render NewJobDialog when hasJulesApiKey is set via env', async () => {
     (useEnv as Mock).mockReturnValue({ hasJulesApiKey: true });
     (useLocalStorage as Mock).mockReturnValue(['', vi.fn()]);

    render(<NewJobPage />);

    expect(await screen.findByTestId('job-dialog')).toBeDefined();
  });
});
