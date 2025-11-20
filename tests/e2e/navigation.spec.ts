
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should verify sidebar links and buttons', async ({ page }) => {
    await page.goto('/');

    // Verify Home link (Logo) - use first() as it appears in Sidebar and Header
    await expect(page.getByRole('link', { name: 'Jules Master' }).first()).toBeVisible();

    // Verify "New Job" button
    await expect(page.getByRole('button', { name: 'New Job' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Job' })).toBeEnabled();

    // Verify "Job List" link
    const jobListLink = page.getByRole('link', { name: 'Job List' });
    await expect(jobListLink).toBeVisible();
    // Click and verify navigation
    await jobListLink.click();

    // Wait for URL
    await expect(page).toHaveURL(/\/jobs/);
    // Use locator for CardTitle (div with specific class or just text outside of link)
    await expect(page.locator('.text-2xl', { hasText: 'Job List' })).toBeVisible();

    // Verify "Session List" link
    // Re-query the element to avoid stale element reference
    const sessionListLink = page.getByRole('link', { name: 'Session List' });
    await expect(sessionListLink).toBeVisible();
    // Click and verify navigation
    await sessionListLink.click();
    await expect(page).toHaveURL('/'); // Session list is home

    // Verify "Messages" link
    // Re-query the element
    const messagesLink = page.getByRole('link', { name: 'Messages' });
    await expect(messagesLink).toBeVisible();
    // Click and verify navigation
    await messagesLink.click();
    await expect(page).toHaveURL(/\/prompts/);
    await expect(page.getByText('Predefined Messages', { exact: true })).toBeVisible();
  });
});
