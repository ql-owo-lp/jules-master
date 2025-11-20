import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    // Set API Key for session listing
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', JSON.stringify('mock-key'));
    });
    await page.goto('/');
  });

  test('shows session list', async ({ page }) => {
    await expect(page.getByText('Session List', { exact: true })).toBeVisible();
  });

  test('shows filters', async ({ page }) => {
    // Check for filters
    await expect(page.getByText('Repository', { exact: true })).toBeVisible();
    await expect(page.getByText('Session Status', { exact: true })).toBeVisible();
    await expect(page.getByText('Job Name', { exact: true })).toBeVisible();
  });

  test('shows mocked session', async ({ page }) => {
      // The mock API returns a session with source 'p/github/mock/repo'
      // The UI parses it to 'mock/repo'
      await expect(page.getByText('mock/repo')).toBeVisible();

      // And the status 'COMPLETED' (mocked).
      // The badge might not have exact text 'COMPLETED'. It might be 'Completed' or mixed case.
      // Let's search for text 'COMPLETED' non-exact or look for a status badge.
      // Assuming the status comes from `s.state`, if it's 'COMPLETED', the badge should probably show it.
      // We can just check .first() or look for it in the table row.
      // Or check case insensitive.
      await expect(page.getByText('COMPLETED', { exact: false }).first()).toBeVisible();
  });

  test('sidebar links', async ({ page }) => {
    // "New Job" is in a button in the sidebar
    await expect(page.getByRole('button', { name: 'New Job' })).toBeVisible();

    // "Job List" is a link
    await expect(page.getByRole('link', { name: 'Job List' })).toBeVisible();
    // "Session List" is a link
    await expect(page.getByRole('link', { name: 'Session List' })).toBeVisible();
    // "Messages" is a link
    await expect(page.getByRole('link', { name: 'Messages' })).toBeVisible();
  });
});
