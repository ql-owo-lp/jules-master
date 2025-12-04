
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { CronJobForm } from '@/components/cron-job-form';
import { vi } from 'vitest';
import * as configActions from '@/app/config/actions';

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

vi.mock('@/app/config/actions', async () => {
    const actual = await vi.importActual('@/app/config/actions');
    return {
        ...actual,
        getGlobalPrompt: vi.fn().mockResolvedValue('global prompt'),
        getRepoPrompt: vi.fn().mockResolvedValue('repo prompt'),
    };
});

describe('CronJobForm', () => {
  it('should correctly apply global and repo prompts when editing a cron job', async () => {
    const initialValues = {
      id: '123',
      name: 'Test Cron Job',
      schedule: '0 0 * * *',
      prompt: 'Initial prompt',
      repo: 'test-owner/test-repo',
      branch: 'main',
      createdAt: new Date().toISOString(),
      enabled: true,
      autoApproval: false,
      sessionCount: 1,
    };

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    );

    const { getByText } = render(
      <CronJobForm
        onCronJobCreated={() => {}}
        onCancel={() => {}}
        initialValues={initialValues}
        selectedSource={{
          githubRepo: {
            owner: 'test-owner',
            repo: 'test-repo',
            branches: [],
            defaultBranch: {
              name: 'main',
              displayName: 'main',
              sha: '123'
            }
          },
          id: '123',
          source: 'GITHUB',
          type: 'REPO',
          name: 'test-repo'
        }}
        selectedBranch="main"
      />
    );

    fireEvent.click(getByText('Update Cron Job'));

    await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/cron-jobs/123', expect.any(Object));
        const fetchBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
        expect(fetchBody.prompt).toContain('global prompt');
        expect(fetchBody.prompt).toContain('repo prompt');
        expect(fetchBody.prompt).toContain('Initial prompt');
    });
  });
});
