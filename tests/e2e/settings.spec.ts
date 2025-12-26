
import { test, expect } from '@playwright/test';

test('should display PR Status Cache Refresh Interval setting', async ({ page }) => {
  // Mock DB
  let prStatusPollInterval = 60;
  await page.route('/api/settings*', async route => {
    if (route.request().method() === 'GET') {
       await route.fulfill({ json: {
           prStatusPollInterval,
           // Provide other defaults to avoid issues
           idlePollInterval: 120,
           activePollInterval: 30,
           defaultSessionCount: 10,
           titleTruncateLength: 50,
           lineClamp: 1,
           sessionItemsPerPage: 10,
           jobsPerPage: 5,
           theme: 'system'
        } });
    } else if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON();
        if (data.prStatusPollInterval) {
            prStatusPollInterval = data.prStatusPollInterval;
        }
        await route.fulfill({ json: { success: true } });
    }
  });

  await page.goto('/settings');

  // Check if the setting input is visible (now in General tab)
  const label = page.getByText('PR Status Cache Refresh Interval (seconds)');
  await expect(label).toBeVisible();

  // Check default value
  const input = page.getByLabel('PR Status Cache Refresh Interval (seconds)');
  await expect(input).toHaveValue('60');

  // Update value
  await input.fill('120');

  // Save changes
  await page.getByRole('button', { name: 'Save General Settings' }).click();

  // Verify toast
  // Use exact match to differentiate from screen reader text which might contain more content
  await expect(page.getByText('Settings Saved', { exact: true })).toBeVisible();

  // Reload and verify persistence
  await page.reload();

  await expect(page.getByLabel('PR Status Cache Refresh Interval (seconds)')).toHaveValue('120');
});
