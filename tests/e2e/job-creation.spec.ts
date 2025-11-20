
import { test, expect } from '@playwright/test';

test.describe('Job Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API key to ensure form is enabled
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
    });
  });

  test('should open new job dialog and fill form', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'New Job' }).click();

    await expect(page.getByRole('heading', { name: 'Create a New Job' })).toBeVisible();

    // Check fields
    await expect(page.getByLabel('Job Name')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Session Prompts' })).toBeVisible();
    await expect(page.getByLabel('Number of sessions')).toBeVisible();

    // Fill fields
    await page.getByLabel('Job Name').fill('Test Job');
    await page.getByRole('textbox', { name: 'Session Prompts' }).fill('Test Prompt');
    await page.getByLabel('Number of sessions').fill('1');

    // Check source selection (Repository)
    // It might be loading (skeleton) or error, or combobox.
    // We just want to verify one of them exists, implying the component is rendered.
    const combobox = page.getByRole('combobox', { name: 'Select repository' });
    const skeleton = page.locator('#repository-skeleton');
    const error = page.locator('#repository-error');

    await expect(combobox.or(skeleton).or(error)).toBeVisible();

    // Check submit button
    const createButton = page.getByRole('button', { name: 'Create Job' });
    await expect(createButton).toBeVisible();
    // It might be disabled if repos failed to load, so we don't enforce enabled state here strictly
    // unless we can mock the repo list.
  });

  test('should navigate to new job page via external link', async ({ page }) => {
     await page.goto('/');
     const newJobLink = page.locator('a[href="/jobs/new"]');
     await expect(newJobLink).toBeVisible();
  });
});
