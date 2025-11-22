
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should verify sidebar links and buttons', async ({ page }) => {
    await page.goto('/');

    // Verify Home link (Logo) - use first() as it appears in Sidebar and Header
    await expect(page.getByRole('link', { name: 'Jules Master' }).first()).toBeVisible();

    // Verify "New Job" button
    await expect(page.getByRole('button', { name: 'New Job' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Job' })).toBeEnabled();

    // Verify "Jobs & Sessions" link (Home)
    const jobsSessionsLink = page.getByRole('link', { name: 'Jobs & Sessions' });
    await expect(jobsSessionsLink).toBeVisible();
    // Click and verify navigation (it is effectively home)
    await jobsSessionsLink.click();
    await expect(page).toHaveURL('/');

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
