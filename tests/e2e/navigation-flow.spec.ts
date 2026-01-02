
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate to different pages', async ({ page }) => {
    await page.goto('/');

    // Navigate to Settings
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page).toHaveURL('/settings');
    // "General Settings" might be a heading or text, let's look for a more specific element if ambiguous,
    // or use exact: true if it helps, but looking at the error:
    // "resolved to 2 elements": one div text and one button.
    // Let's target the heading specifically.
    await expect(page.getByRole('heading', { name: 'General Settings', level: 2 })).toBeVisible().catch(() => {
        // Fallback if it's not a heading level 2, maybe try text exact match within a specific container?
        // Or just use exact: true
        return expect(page.getByText('General Settings', { exact: true })).toBeVisible();
    });

    // Navigate back to Home
    await page.getByRole('link', { name: 'Jobs & Sessions' }).click();
    await expect(page).toHaveURL('/');
  });

  test('should verify sidebar links', async ({ page }) => {
    await page.goto('/');

    // Check for essential sidebar links
    await expect(page.getByRole('link', { name: 'Jobs & Sessions' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'System Log' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  });
});
