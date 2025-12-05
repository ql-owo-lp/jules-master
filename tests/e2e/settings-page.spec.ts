
import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test('should verify settings page layout and tabs', async ({ page }) => {
    // Navigate to the home page first
    await page.goto('/');

    // Wait for the sidebar to load and click Settings
    // The sidebar link for Settings should have "Settings" text
    await page.getByRole('link', { name: 'Settings' }).click();

    // Wait for navigation to /settings
    await expect(page).toHaveURL(/\/settings/);

    // Verify Tabs are present
    await expect(page.getByRole('tab', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Messages' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Automation' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Display' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Configuration' })).not.toBeVisible();

    // Verify General Tab content (default)
    await expect(page.getByLabel('Jules API Key')).toBeVisible();
    // Verify Advanced settings moved to General tab
    await expect(page.getByLabel('Idle Poll Interval (seconds)')).toBeVisible();
  });

  test('should switch tabs and show content', async ({ page }) => {
    await page.goto('/settings');

    // Switch to Messages tab
    await page.getByRole('tab', { name: 'Messages' }).click();

    // Wait for Global Prompt to appear
    // Using locator with exact text match to avoid matching button text
    await expect(page.locator(':text-is("Global Prompt")')).toBeVisible();
    await expect(page.locator(':text-is("Per-Repository Prompt")')).toBeVisible();

    // Switch to Automation tab
    await page.getByRole('tab', { name: 'Automation' }).click();
    await expect(page.getByLabel('Auto Retry Failed Sessions')).toBeVisible();

     // Switch to Display tab
    await page.getByRole('tab', { name: 'Display' }).click();
    await expect(page.getByLabel('Jobs Per Page')).toBeVisible();
  });
});
