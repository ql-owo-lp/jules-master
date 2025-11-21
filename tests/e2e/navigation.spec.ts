
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to the home page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Jules Master/);
    await expect(page.getByRole('link', { name: 'Session List' })).toBeVisible();
  });

  test('should navigate to the Job List page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Job List' }).click();

    // Use text locator
    await expect(page.getByText('Job List', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/jobs/);
  });

  test('should navigate to the Messages page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Messages' }).click();

    // Use text locator
    await expect(page.getByText('Predefined Messages', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/prompts/);
  });
});
