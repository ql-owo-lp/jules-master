import { test, expect } from '@playwright/test';

test.describe('Filtering', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API key so the app tries to fetch sessions
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
      // Mock some sessions to test filtering
      window.localStorage.setItem('jules-sessions', JSON.stringify([
        { id: '1', state: 'Completed', title: 'Completed Session 1', createdAt: new Date().toISOString(), prompt: '[TOPIC]: # (Work on test/repo1)\ndo something in test/repo1', summary: null, pr_url: null, pr_status: null, updatedAt: new Date().toISOString(), repo: 'test/repo1', correlation_id: null, error: null, provider: 'test' },
        { id: '2', state: 'Awaiting User Feedback', title: 'Awaiting Feedback Session', createdAt: new Date().toISOString(), prompt: '[TOPIC]: # (Work on test/repo1)\nanother thing for test/repo1', summary: null, pr_url: null, pr_status: null, updatedAt: new Date().toISOString(), repo: 'test/repo1', correlation_id: null, error: null, provider: 'test' },
        { id: '3', state: 'Completed', title: 'Completed Session 2', createdAt: new Date().toISOString(), prompt: '[TOPIC]: # (Work on test/repo2)\nwork on test/repo2', summary: null, pr_url: null, pr_status: null, updatedAt: new Date().toISOString(), repo: 'test/repo2', correlation_id: null, error: null, provider: 'test' },
        { id: '4', state: 'Running', title: 'Running Session', createdAt: new Date().toISOString(), prompt: '[TOPIC]: # (Work on test/repo2)\na task for test/repo2', summary: null, pr_url: null, pr_status: null, updatedAt: new Date().toISOString(), repo: 'test/repo2', correlation_id: null, error: null, provider: 'test' },
        { id: '5', state: 'Completed', title: 'Uncategorized Completed', createdAt: new Date().toISOString(), prompt: 'p5', summary: null, pr_url: null, pr_status: null, updatedAt: new Date().toISOString(), repo: 'test/repo3', correlation_id: null, error: null, provider: 'test' },
      ]));
       window.localStorage.setItem('jules-jobs', JSON.stringify([]));
    });
    await page.goto('/');
    await page.waitForSelector('[data-radix-collection-item]:has-text("Uncategorized Sessions")');
    await page.waitForTimeout(1000);
  });

  test('should filter sessions by status', async ({ page }) => {
    // Wait for accordions to be visible
    await expect(page.getByRole('button', { name: /Work on test\/repo1/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Work on test\/repo2/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Uncategorized Sessions/ })).toBeVisible();

    // Expand all accordions
    await page.getByRole('button', { name: /Work on test\/repo1/ }).click();
    await page.getByRole('button', { name: /Work on test\/repo2/ }).click();
    await page.getByRole('button', { name: /Uncategorized Sessions/ }).click();

    // Check that all sessions are visible initially
    await expect(page.getByText('Completed Session 1')).toBeVisible();
    await expect(page.getByText('Awaiting Feedback Session')).toBeVisible();
    await expect(page.getByText('Completed Session 2')).toBeVisible();
    await expect(page.getByText('Running Session')).toBeVisible();
    await expect(page.getByText('Uncategorized Completed')).toBeVisible();

    // Find the combobox by its associated label
    const statusFilterCombobox = page.locator('div.space-y-2:has-text("Session Status")').getByRole('combobox');
    await statusFilterCombobox.click();

    // Filter by 'Completed'
    await page.getByRole('option', { name: 'Completed' }).click();

    // Accordions might re-render, need to wait for them to be stable
    await expect(page.getByRole('button', { name: /Work on test\/repo1/ })).toBeVisible();

    // The component might re-render and collapse the accordions. Let's re-expand if needed.
    if (await page.getByRole('button', { name: /Work on test\/repo1/ }).getAttribute('aria-expanded') === 'false') {
      await page.getByRole('button', { name: /Work on test\/repo1/ }).click();
    }
    if (await page.getByRole('button', { name: /Work on test\/repo2/ }).getAttribute('aria-expanded') === 'false') {
      await page.getByRole('button', { name: /Work on test\/repo2/ }).click();
    }
    if (await page.getByRole('button', { name: /Uncategorized Sessions/ }).getAttribute('aria-expanded') === 'false') {
      await page.getByRole('button', { name: /Uncategorized Sessions/ }).click();
    }

    // Check that only 'Completed' sessions are visible
    await expect(page.getByText('Completed Session 1')).toBeVisible();
    await expect(page.getByText('Completed Session 2')).toBeVisible();
    await expect(page.getByText('Uncategorized Completed')).toBeVisible();
    await expect(page.getByText('Awaiting Feedback Session')).toBeHidden();
    await expect(page.getByText('Running Session')).toBeHidden();

    // Clear filter
    await statusFilterCombobox.click();
    await page.getByRole('option', { name: 'All Statuses' }).click();

    // Check that accordions are still there
    await expect(page.getByRole('button', { name: /Work on test\/repo1/ })).toBeVisible();

    // Re-expand if needed
    if (await page.getByRole('button', { name: /Work on test\/repo1/ }).getAttribute('aria-expanded') === 'false') {
      await page.getByRole('button', { name: /Work on test\/repo1/ }).click();
    }
    if (await page.getByRole('button', { name: /Work on test\/repo2/ }).getAttribute('aria-expanded') === 'false') {
      await page.getByRole('button', { name: /Work on test\/repo2/ }).click();
    }
     if (await page.getByRole('button', { name: /Uncategorized Sessions/ }).getAttribute('aria-expanded') === 'false') {
      await page.getByRole('button', { name: /Uncategorized Sessions/ }).click();
    }

    // Check that all sessions are visible again
    await expect(page.getByText('Completed Session 1')).toBeVisible();
    await expect(page.getByText('Awaiting Feedback Session')).toBeVisible();
    await expect(page.getByText('Completed Session 2')).toBeVisible();
    await expect(page.getByText('Running Session')).toBeVisible();
    await expect(page.getByText('Uncategorized Completed')).toBeVisible();
  });
});
