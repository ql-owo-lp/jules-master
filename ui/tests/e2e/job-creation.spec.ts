
import { test, expect } from '@playwright/test';

test.describe('Job Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API key to ensure form is enabled
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key-default', '"test-api-key"');
    });
  });

  test('should open new job dialog and fill form with mock data', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Create New Job' }).click();

    await expect(page.getByRole('heading', { name: 'Create a New Job' })).toBeVisible();

    // Fill fields
    await page.getByLabel('Job Name (Optional)').fill('Test Job');
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
    // Note: There might be other comboboxes (e.g. for prompt suggestions), so we filter by text or use a more specific locator.
    // Since we expect it to be auto-selected with the repo name:
    const repoCombobox = page.getByRole('combobox').filter({ hasText: /test-owner\/test-repo/ }).first();
    await expect(repoCombobox).toBeEnabled();
    await expect(repoCombobox).toHaveText(/test-owner\/test-repo/);

    // Select Branch
    // Branch combobox should also be visible. It usually defaults to 'main'.
    const branchCombobox = page.getByRole('combobox').filter({ hasText: /main/ }).first();
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
});
