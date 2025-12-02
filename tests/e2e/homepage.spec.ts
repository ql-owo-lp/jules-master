
import { test, expect } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  await page.goto('/');
  // Verify that the main content area loads by checking for specific text
  await expect(page.getByText('Jobs & Sessions')).toBeVisible({ timeout: 10000 });
});
