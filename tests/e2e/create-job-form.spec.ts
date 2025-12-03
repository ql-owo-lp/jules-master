
import { test, expect } from '@playwright/test';

test.describe('Create Job Form', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API key to ensure the form is enabled
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
    });
    await page.goto('/');
  });

  test('should create a new job and see it in the list', async ({ page }) => {
    await page.getByRole('button', { name: 'Create New Job' }).click();

    await page.getByLabel('Job Name').fill('E2E Test Job');
    await page.getByLabel('Repository').fill('test/repo');
    await page.getByLabel('Branch').fill('main');
    await page.getByLabel('Prompts').fill('Test prompt 1\nTest prompt 2');

    await page.getByRole('button', { name: 'Create Job' }).click();

    // Wait for the form to disappear
    await expect(page.getByLabel('Job Name')).toBeHidden();

    // Check that the new job is in the list
    await expect(page.getByText('E2E Test Job')).toBeVisible();
    await expect(page.getByText('test/repo / main')).toBeVisible();
  });
});
