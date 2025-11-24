
import { test, expect } from '@playwright/test';

test('should display PR Status Cache Refresh Interval setting', async ({ page }) => {
  await page.goto('/settings');

  // Switch to Configuration tab
  await page.getByRole('tab', { name: 'Configuration' }).click();

  // Check if the setting input is visible
  const label = page.getByText('PR Status Cache Refresh Interval (seconds)');
  await expect(label).toBeVisible();

  // Check default value
  const input = page.getByLabel('PR Status Cache Refresh Interval (seconds)');
  await expect(input).toHaveValue('60');

  // Update value
  await input.fill('120');

  // Save changes
  await page.getByRole('button', { name: 'Save Configuration' }).click();

  // Verify toast
  // Use exact match to differentiate from screen reader text which might contain more content
  await expect(page.getByText('Settings Saved', { exact: true })).toBeVisible();

  // Reload and verify persistence
  await page.reload();

  // Switch to Configuration tab
  await page.getByRole('tab', { name: 'Configuration' }).click();

  await expect(page.getByLabel('PR Status Cache Refresh Interval (seconds)')).toHaveValue('120');
});
