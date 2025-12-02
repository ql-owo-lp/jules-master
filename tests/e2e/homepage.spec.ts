
import { test, expect } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  // The verification script verified that the main content loads.
  // The python script checked for "main" selector.
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible({ timeout: 10000 });

  // Also verifying that "Jobs & Sessions" text is visible as seen in screenshot
  await expect(page.getByText('Jobs & Sessions')).toBeVisible();
});
