
import { test, expect } from '@playwright/test';

test('create a new job', async ({ page }) => {
  await page.goto('http://localhost:9002');

  await page.fill('textarea', 'test prompt');

  await page.click('button[type="submit"]');

  await expect(page.locator('text=Job Created')).toBeVisible();
});
