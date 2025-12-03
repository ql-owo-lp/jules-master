
import { test, expect } from '@playwright/test';

test.describe('Header Job Creation', () => {
  test('should open new job dialog from header button', async ({ page }) => {
    await page.goto('/');

    // Click the "Create New Job" button in the header
    await page.getByRole('button', { name: 'Create New Job' }).click();

    // Verify the dialog is visible
    await expect(page.getByRole('heading', { name: 'Create a New Job' })).toBeVisible();
  });
});
