import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Jules Master/);
});

test('navigation to jobs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Job List' }).click();
  await expect(page).toHaveURL(/.*\/jobs/);

  // Check for Job List title in main area to avoid sidebar match
  const main = page.locator('main');
  await expect(main.getByText('Job List', { exact: true })).toBeVisible();
});

test('navigation to messages', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Messages' }).click();
  await expect(page).toHaveURL(/.*\/prompts/);

  const main = page.locator('main');
  await expect(main.getByText('Predefined Messages', { exact: true })).toBeVisible();
});
