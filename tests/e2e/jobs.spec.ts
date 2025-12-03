
import { test, expect } from '@playwright/test';

test.describe('Jobs Page', () => {
  test('should allow a user to navigate to the jobs page and see a list of jobs', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');

    // Click the "Jobs" link in the sidebar
    await page.getByRole('link', { name: 'Jobs' }).click();

    // Expect the URL to be /jobs
    await expect(page).toHaveURL('/jobs');

    // Expect the "Jobs" heading to be visible
    await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible();

    // Expect the table headers to be visible
    await expect(page.getByText('Name')).toBeVisible();
    await expect(page.getByText('Repository')).toBeVisible();
    await expect(page.getByText('Created At')).toBeVisible();
    await expect(page.getByText('Session Count')).toBeVisible();
  });
});
