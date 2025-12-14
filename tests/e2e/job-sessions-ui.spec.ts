
import { test, expect } from '@playwright/test';

test.describe('Job and Sessions UI', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API key and job/session data
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
      window.localStorage.setItem('jules-jobs', JSON.stringify([
        { id: 'job-1', name: 'Test Job 1', sessionIds: ['session-1'], createdAt: new Date().toISOString() }
      ]));
      window.localStorage.setItem('jules-sessions', JSON.stringify([
        { id: 'session-1', title: 'Test Session 1', state: 'COMPLETED', createTime: new Date().toISOString() }
      ]));
    });
  });

  test('should display job creation time and sessions under the correct job', async ({ page }) => {
    await page.goto('/');

    // Expand the job accordion
    const jobAccordion = page.getByRole('button', { name: /Test Job 1/ });
    await expect(jobAccordion).toBeVisible({ timeout: 10000 });
    if (await jobAccordion.getAttribute('aria-expanded') === 'false') {
      await jobAccordion.click();
    }

    // Check for the job creation time (e.g., "a few seconds ago")
    await expect(page.getByText(/ago\)/)).toBeVisible();

    // Check that the session is displayed under the job
    await expect(page.getByText('Test Session 1')).toBeVisible();
    await expect(page.getByText('COMPLETED')).toBeVisible();
  });
});
