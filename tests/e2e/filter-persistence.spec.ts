
import { test, expect } from '@playwright/test';

test('should persist repository and status filters in the URL', async ({ page }) => {
  await page.goto('/');

  // Select a repository filter
  await page.click('button[name="filter-repo"]');
  await page.click('div[role="option"]:has-text("All Repositories")');

  // Wait for the URL to update with the repo filter
  await expect(page).toHaveURL(/repo=all/);

  // Select a status filter
  await page.click('button[name="filter-status"]');
  await page.click('div[role="option"]:has-text("All Statuses")');

  // Verify that the filters are in the URL
  await expect(page).toHaveURL(/repo=all/);
  await expect(page).toHaveURL(/status=all/);
});
