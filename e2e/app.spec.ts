import { test, expect } from '@playwright/test';

test.describe('Jules Master E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Inject a mock API key into local storage so the form is enabled
    await page.evaluate(() => {
        localStorage.setItem('jules-api-key', '"mock-api-key"');
    });
    // Reload to ensure the component picks up the local storage change on mount
    await page.reload();
  });

  test('Homepage loads and displays title', async ({ page }) => {
    await expect(page.locator('header h1').filter({ hasText: 'Jules Master' })).toBeVisible();
    await expect(page.locator('div').filter({ hasText: 'Session List' }).first()).toBeVisible();
  });

  test('Settings sheet opens and can save settings', async ({ page }) => {
    await page.getByLabel('Open settings').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.getByLabel('Jules API Key')).toBeVisible();

    const pollIntervalInput = page.getByLabel('Job List Poll Interval (seconds)');
    await pollIntervalInput.fill('100');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    await page.getByLabel('Open settings').click();
    await expect(pollIntervalInput).toHaveValue('100');
  });

  test('Navigation to Job List works', async ({ page }) => {
    await page.getByRole('link', { name: 'Job List' }).click();
    await expect(page).toHaveURL(/.*\/jobs/);
    await expect(page.getByText('Job List', { exact: true }).first()).toBeVisible();
  });

  test('Navigation to Messages works', async ({ page }) => {
    await page.getByRole('link', { name: 'Messages' }).click();
    await expect(page).toHaveURL(/.*\/prompts/);
    await expect(page.getByText('Global Prompt', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Predefined Messages', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Quick Replies', { exact: true }).first()).toBeVisible();
  });

  test('New Job Dialog opens and validates input', async ({ page }) => {
    await page.getByRole('button', { name: 'New Job' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Job' })).toBeVisible();

    await expect(page.getByLabel('Job Name (Optional)')).toBeVisible();
    await expect(page.getByLabel('Number of sessions')).toBeVisible();
    await expect(page.locator('label').filter({ hasText: 'Prompt' }).first()).toBeVisible();

    const jobName = 'E2E Test Job ' + Date.now();
    await page.getByLabel('Job Name (Optional)').fill(jobName);
    await page.getByLabel('Number of sessions').fill('1');
    await page.getByRole('textbox', { name: 'Session Prompts' }).fill('This is a test prompt');

    const createButton = page.getByRole('button', { name: 'Create Job' });
    await expect(createButton).toBeVisible();
    // SourceSelection auto-selects the first repository if available, so the button should be enabled
    await expect(createButton).toBeEnabled();
  });

});
