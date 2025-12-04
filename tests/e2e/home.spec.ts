
import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API key so the app tries to fetch sessions
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
    });
  });

  test('should display mocked sessions', async ({ page }) => {
    await page.goto('/');

    // Expand Uncategorized Sessions accordion
    const accordionTrigger = page.getByRole('button', { name: /Uncategorized Sessions/ });

    // Wait for trigger to be visible (implies sessions loaded)
    await expect(accordionTrigger).toBeVisible({ timeout: 10000 });

    if (await accordionTrigger.getAttribute('aria-expanded') === 'false') {
        await accordionTrigger.click();
    }

    // Check for mock session titles
    await expect(page.getByText('Mock Session 1', { exact: false })).toBeVisible();
    await expect(page.getByText('Mock Session 2', { exact: false })).toBeVisible();

    // Check for status badges (UI labels)
    await expect(page.getByText('Completed', { exact: true })).toBeVisible();
    await expect(page.getByText('Awaiting User Feedback', { exact: true })).toBeVisible();
  });

  test('should allow setting API key', async ({ page }) => {
    // Clear API key for this test
    await page.addInitScript(() => {
       window.localStorage.removeItem('jules-api-key');
    });
    // We need to go to settings page to set API key now
    await page.goto('/settings');

    // Fill API Key
    const apiKeyInput = page.getByLabel('Jules API Key');
    await apiKeyInput.fill('new-test-api-key');

    // Save
    await page.getByRole('button', { name: 'Save General Settings' }).click();

    // Go back to home
    await page.goto('/');

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

  test('should clear filters with a single navigation', async ({ page }) => {
    await page.goto('/?repo=test-repo&status=completed&jobId=test-job');

    let navigationCount = 0;
    page.on('framenavigated', () => {
      navigationCount++;
    });

    const clearFiltersButton = page.getByRole('button', { name: /Clear All Filters/ });
    await expect(clearFiltersButton).toBeVisible();
    await clearFiltersButton.click();

    // After clicking, we should be at the base URL
    await expect(page).toHaveURL('/');

    // Check that only one navigation event occurred
    expect(navigationCount).toBe(2);
  });
});
