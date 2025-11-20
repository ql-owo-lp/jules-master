
import { test, expect } from '@playwright/test';

test.describe('Job Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API key to ensure form is enabled
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
    });
  });

  test('should open new job dialog and fill form with mock data', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'New Job' }).click();

    await expect(page.getByRole('heading', { name: 'Create a New Job' })).toBeVisible();

    // Fill fields
    await page.getByLabel('Job Name').fill('Test Job');
    await page.getByRole('textbox', { name: 'Session Prompts' }).fill('Test Prompt');
    await page.getByLabel('Number of sessions').fill('1');

    // Select Repository from Mock Data
    // Wait for skeleton to disappear
    await expect(page.locator('#repository-skeleton')).toBeHidden({ timeout: 10000 });

    // Check if error appeared
    const error = page.locator('#repository-error');
    if (await error.isVisible()) {
        console.log('Repository Error:', await error.innerText());
    }
    await expect(error).toBeHidden();

    // The mock data has "github/test-owner/test-repo"
    // Since SourceSelection auto-selects the first source, the combobox label will change to the repo name.

    // We expect the repo to be auto-selected
    const repoCombobox = page.getByRole('combobox').nth(0);
    await expect(repoCombobox).toBeEnabled();
    await expect(repoCombobox).toHaveText(/test-owner\/test-repo/);

    // Select Branch
    const branchCombobox = page.getByRole('combobox').nth(1);
    await expect(branchCombobox).toBeVisible();

    // Wait for it to be enabled (implies source is selected)
    await expect(branchCombobox).toBeEnabled();

    // Verify 'main' is selected (default branch)
    await expect(branchCombobox).toHaveText(/main/);

    await branchCombobox.click();
    await expect(page.getByRole('option', { name: 'main' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'develop' })).toBeVisible();
    await page.getByRole('option', { name: 'develop' }).click(); // Switch to develop

    // Check submit button
    const createButton = page.getByRole('button', { name: 'Create Job' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
  });

  test('should navigate to new job page via external link', async ({ page }) => {
     await page.goto('/');
     const newJobLink = page.locator('a[href="/jobs/new"]');
     await expect(newJobLink).toBeVisible();
  });
});
