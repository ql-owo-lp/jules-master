
import { test, expect } from '@playwright/test';

test.describe('Settings Page - Advanced Section', () => {
  test('should verify advanced settings are visible in General tab', async ({ page }) => {
    // Navigate to the settings page
    await page.goto('/settings');

    // Wait for the Settings heading
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Verify General Settings card is visible
    // Using text locator as CardTitle might not have a specific role, or it's just text inside an h3/div
    await expect(page.getByText('General Settings', { exact: true })).toBeVisible();

    // Verify Advanced section is visible
    await expect(page.getByText('Advanced', { exact: true })).toBeVisible();

    // Verify Advanced fields are present
    await expect(page.getByRole('spinbutton', { name: 'Idle Poll Interval (seconds)' })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Default Session Count for New Jobs' })).toBeVisible();

    // Check if Configuration tab is NOT present (double check)
    await expect(page.getByRole('tab', { name: 'Configuration' })).not.toBeVisible();
  });
});
