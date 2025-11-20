import { test, expect } from '@playwright/test';

test.describe('Jobs Page', () => {
  test('jobs list elements', async ({ page }) => {
    await page.goto('/jobs');
    const main = page.locator('main');
    await expect(main.getByText('Job List', { exact: true })).toBeVisible();
    await expect(main.locator('table').first()).toBeVisible();
  });

  test('create new job flow', async ({ page }) => {
    // Set API Key in localStorage to enable the form
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', JSON.stringify('mock-key'));
    });

    await page.goto('/jobs/new');
    const main = page.locator('main');

    // Wait for form to be enabled
    await expect(page.getByText('API Key Not Set')).not.toBeVisible();

    // 1. Fill in Job Name
    const jobName = `Test Job ${Date.now()}`;
    await page.getByLabel('Job Name (Optional)').fill(jobName);

    // 2. Fill in Session Count
    await page.getByLabel('Number of sessions').fill('1');

    // 3. Select Repository (Mocked)
    // Wait for the repository to be loaded and auto-selected
    const repoCombobox = page.locator('button[role="combobox"]').filter({ hasText: 'mock-owner/mock-repo' });
    await expect(repoCombobox).toBeVisible({ timeout: 10000 });

    // 4. Select Branch (Mocked)
    const branchCombobox = page.locator('button[role="combobox"]').filter({ hasText: 'main' });
    await expect(branchCombobox).toBeVisible();

    // 5. Fill in Prompt
    await page.getByRole('textbox', { name: 'Session Prompts' }).fill('Test prompt for new job');

    // 6. Click Create Job
    await page.getByRole('button', { name: 'Create Job' }).click();

    // 7. Expect redirection to Job List or Job Detail
    await expect(page).toHaveURL(/\/\?jobId=.*/);

    // 8. Verify success message
    // Use .first() to avoid strict mode violation if multiple elements match
    await expect(page.getByText('Job submitted!').first()).toBeVisible();
  });
});
