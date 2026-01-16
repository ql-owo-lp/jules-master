
import { test, expect } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  await page.goto('/');
  // Verify that the main content area loads by checking for specific text
  // Use .first() if multiple elements match, or scope it better. 
  // It seems there is a link and a header. Let's check for heading specifically if possible, or just the first one.
  await expect(page.getByRole('heading', { name: 'Jobs & Sessions', exact: true }).or(page.getByText('Jobs & Sessions').nth(0))).toBeVisible({ timeout: 10000 });
});
