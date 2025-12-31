
import { test, expect } from '@playwright/test';

test('verify settings page UI', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText('Save General Settings')).toBeVisible();
});
