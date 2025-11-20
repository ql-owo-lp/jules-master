
import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display API key warning when not set', async ({ page }) => {
    // Ensure local storage is empty
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.getByText('API Key Not Set')).toBeVisible();
  });

  test('should allow setting API key', async ({ page }) => {
    await page.goto('/');

    // Click settings (Header component)
    await page.getByRole('button', { name: 'Open settings' }).click();

    // Fill API Key
    const apiKeyInput = page.getByLabel('Jules API Key');
    await apiKeyInput.fill('test-api-key');

    // Fill GitHub Token
    const githubTokenInput = page.getByLabel('GitHub Personal Access Token');
    await githubTokenInput.fill('test-github-token');

    // Save
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Verify alert is gone
    await expect(page.getByText('API Key Not Set')).toBeHidden();
  });

  test('should filter sessions', async ({ page }) => {
     await page.goto('/');

     // Check if filter inputs are present
     await expect(page.getByText('Repository', { exact: true })).toBeVisible(); // Label
     await expect(page.getByText('Session Status', { exact: true })).toBeVisible(); // Label
     await expect(page.getByText('Job Name', { exact: true })).toBeVisible(); // Label
  });
});
