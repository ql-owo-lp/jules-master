
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should verify sidebar links and buttons', async ({ page }) => {
    await page.goto('/');

    // Verify Home link (Logo) - use first() as it appears in Sidebar and Header
    await expect(page.getByRole('link', { name: 'Jules Master' }).first()).toBeVisible();

    // Verify "New Job" button in the main content area (not sidebar)
    const newJobButton = page.locator('main').getByRole('button', { name: 'New Job' });
    await expect(newJobButton).toBeVisible();
    await expect(newJobButton).toBeEnabled();

    // Verify "Jobs & Sessions" link
    const jobListLink = page.getByRole('link', { name: 'Jobs & Sessions' });
    await expect(jobListLink).toBeVisible();
    // Click and verify navigation
    await jobListLink.click();

    // Wait for URL
    await expect(page).toHaveURL(/\/$/);
    // Use locator for CardTitle (div with specific class or just text outside of link)
    await expect(page.locator('.text-2xl', { hasText: 'Jobs & Sessions' })).toBeVisible();

    // Verify "Session List" link (Jobs & Sessions covers this)
    // Skipping explicit check for "Session List" as it seems merged into "Jobs & Sessions"

    // Verify "Settings" link
    // Re-query the element
    const settingsLink = page.getByRole('link', { name: 'Settings' });
    await expect(settingsLink).toBeVisible();
    // Click and verify navigation
    await settingsLink.click();
    await expect(page).toHaveURL(/\/settings/);
    // Use heading role to be specific
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  });
});
