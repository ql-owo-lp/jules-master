import { test, expect } from '@playwright/test';

test.describe('Prompts Page', () => {
  test.beforeEach(async ({ page }) => {
    // Set API Key just in case
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', JSON.stringify('mock-key'));
    });
    await page.goto('/prompts');
  });

  test('system prompts elements', async ({ page }) => {
    // "Predefined Messages" is the CardTitle
    await expect(page.getByText('Predefined Messages', { exact: true })).toBeVisible();

    // Global Prompt section
    await expect(page.getByText('Global Prompt', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Global Prompt' })).toBeVisible();

    // Quick Replies section
    await expect(page.getByText('Quick Replies', { exact: true })).toBeVisible();
    // "Add New" buttons are used for both prompts and replies.
    await expect(page.getByRole('button', { name: 'Add New' }).first()).toBeVisible();
  });

  test('add new message', async ({ page }) => {
    // Click "Add New" for Messages (first one)
    await page.getByRole('button', { name: 'Add New' }).first().click();

    // Dialog should appear
    await expect(page.getByRole('heading', { name: 'Add New Message' })).toBeVisible();

    // Fill form
    await page.getByLabel('Title').fill('Test Message Title');
    await page.getByLabel('Content', { exact: true }).fill('Test Message Content');

    // Save
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify toast and new row. Using .first() to handle strict mode.
    await expect(page.getByText('Message added').first()).toBeVisible();
    // Verify the row appears.
    await expect(page.getByRole('cell', { name: 'Test Message Title' }).first()).toBeVisible();
  });

  test('save global prompt', async ({ page }) => {
    await page.getByLabel('Global Prompt Text').fill('This is a global prompt test');
    await page.getByRole('button', { name: 'Save Global Prompt' }).click();
    await expect(page.getByText('Global Prompt Saved').first()).toBeVisible();
  });
});
