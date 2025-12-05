
import { test, expect } from '@playwright/test';
import { Job, Session } from '@/lib/types';

test.describe('Home Page with Mock Data', () => {

  const mockJobs: Job[] = [
    {
      id: 'job-1',
      name: 'Test Job 1',
      sessionIds: ['session-1'],
      createdAt: new Date().toISOString(),
      repo: 'test-owner/test-repo',
      branch: 'main',
    },
  ];

  const mockSessions: Session[] = [
    {
      id: 'session-1',
      name: 'sessions/session-1',
      title: 'Test Session 1',
      prompt: '[TOPIC]: # (Test Job 1)',
      state: 'COMPLETED',
      createTime: new Date().toISOString(),
    },
     {
      id: 'session-2',
      name: 'sessions/session-2',
      title: 'Uncategorized Session',
      prompt: 'A session without a topic.',
      state: 'IN_PROGRESS',
      createTime: new Date().toISOString(),
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Mock local storage to prevent API calls and provide controlled data
    await page.addInitScript(({ jobs, sessions }) => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
      window.localStorage.setItem('jules-jobs', JSON.stringify(jobs));
      window.localStorage.setItem('jules-sessions', JSON.stringify(sessions));
      // Set last updated time to now to prevent fetching
      window.localStorage.setItem('jules-last-updated-at', Date.now().toString());
    }, { jobs: mockJobs, sessions: mockSessions });

    await page.goto('/');
  });

  test('should display job with creation time', async ({ page }) => {
    // Check for job name
    await expect(page.getByText('Test Job 1')).toBeVisible();

    // Check for creation time (relative format)
    await expect(page.getByText(/ago/)).toBeVisible();
  });

  test('should display sessions under the correct job', async ({ page }) => {
    const accordionTrigger = page.getByRole('button', { name: /Test Job 1/ });
    await expect(accordionTrigger).toBeVisible();

    // The accordion might be open by default, but click it to be sure
    if (await accordionTrigger.getAttribute('aria-expanded') === 'false') {
      await accordionTrigger.click();
    }

    // Check that the session associated with the job is visible
    await expect(page.getByRole('cell', { name: 'Test Session 1' })).toBeVisible();

    // Check that the uncategorized session is NOT under this job
    await expect(page.getByRole('cell', { name: 'Uncategorized Session' })).toBeHidden();
  });

  test('should display uncategorized sessions separately', async ({ page }) => {
    const uncategorizedTrigger = page.getByRole('button', { name: /Uncategorized Sessions/ });
    await expect(uncategorizedTrigger).toBeVisible();

    if (await uncategorizedTrigger.getAttribute('aria-expanded') === 'false') {
      await uncategorizedTrigger.click();
    }

    // Check that the uncategorized session is visible
    await expect(page.getByRole('cell', { name: 'Uncategorized Session' })).toBeVisible();

    // Check that the job-related session is NOT here
    await expect(page.getByRole('cell', { name: 'Test Session 1' })).toBeHidden();
  });
});
