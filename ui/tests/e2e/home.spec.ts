
import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API key so the app tries to fetch sessions
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key-default', '"test-api-key"');
    });
  });

  test('should display mocked sessions', async ({ page }) => {
    await page.goto('/');
    // ... rest of test
  });

  test('should allow setting API key', async ({ page }) => {
    // Clear API key for this test
    await page.addInitScript(() => {
       window.localStorage.removeItem('jules-api-key-default');
    });
    // We need to go to settings page to set API key now
    await page.goto('/settings');

    // Fill API Key
    const apiKeyInput = page.getByLabel('Jules API Key');
    await apiKeyInput.fill('new-test-api-key');

    // Save
    await page.getByRole('button', { name: 'Save General Settings' }).click();
    await expect(page.getByText('Settings Saved')).toBeVisible();

    // Go back to home
    await page.getByRole('link', { name: 'Jules' }).first().click();
    
    // Verify alert is gone
    const apiKey = await page.evaluate(() => localStorage.getItem('jules-api-key-default'));
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
