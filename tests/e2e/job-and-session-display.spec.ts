
import { test, expect } from '@playwright/test';

test.describe('Job and Session Display', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API key so the app tries to fetch sessions
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
      window.localStorage.setItem('jules-jobs', JSON.stringify([
        { id: 'job-1', name: 'Test Job 1', createdAt: new Date().toISOString(), sessionIds: ['session-1'] },
      ]));
      window.localStorage.setItem('jules-sessions', JSON.stringify([
        { id: 'session-1', title: 'Test Session 1', state: 'COMPLETED', createTime: new Date().toISOString() },
      ]));
    });
  });

  test('should display job creation time', async ({ page }) => {
    await page.goto('/');
    const jobAccordion = page.getByRole('button', { name: /Test Job 1/ });
    await expect(jobAccordion).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/ago/)).toBeVisible();
  });

  test('should display sessions under their job', async ({ page }) => {
    await page.goto('/');
    const jobAccordion = page.getByRole('button', { name: /Test Job 1/ });
    await expect(jobAccordion).toBeVisible({ timeout: 10000 });

    if (await jobAccordion.getAttribute('aria-expanded') === 'false') {
      await jobAccordion.click();
    }

    await expect(page.getByText('Test Session 1')).toBeVisible();
  });
});
