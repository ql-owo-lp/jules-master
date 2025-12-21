
import { test, expect } from '@playwright/test';

test('should persist repository and status filters in the URL', async ({ page }) => {
  await page.goto('/');

  // Select a repository filter
  await page.click('button[name="filter-repo"]');
  await page.click('div[role="option"]:has-text("All Repositories")');
  await page.waitForTimeout(500);

  // Select a status filter
  await page.click('button[name="filter-status"]');
  await page.click('div[role="option"]:has-text("All Statuses")');

  // Verify that the filters are in the URL
  await expect(page).toHaveURL('http://localhost:9002/?repo=all&status=all');
});
