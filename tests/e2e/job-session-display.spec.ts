
import { test, expect } from '@playwright/test';

test.describe('Job Session Display', () => {
  test.beforeEach(async ({ page }) => {
    // The web server is started with MOCK_API=true, so we don't need to mock the API here.
    // We just need to ensure the API key is set in local storage.
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
    });
    await page.goto('/');
  });

  test('should display mock job and session', async ({ page }) => {
    // Check for the mock job name from src/app/config/actions.ts
    await expect(page.getByText('Mock Job 1')).toBeVisible();

    // Check for the job creation time (e.g., "a few seconds ago")
    await expect(page.getByText(/ago/)).toBeVisible();

    // The job accordion should be present
    const jobAccordion = page.locator('[data-state="closed"]').first();
    await expect(jobAccordion).toBeVisible();

    // Click the job to expand it
    await page.getByText('Mock Job 1').click();

    // Check if the session title is visible from src/app/sessions/actions.ts
    await expect(page.getByText('Mock Session 1')).toBeVisible();
  });

  test('should create a new job and display it with a session', async ({ page }) => {
    await page.getByRole('button', { name: 'Create New Job' }).click();

    await expect(page.getByRole('heading', { name: 'Create a New Job' })).toBeVisible();

    // Fill fields
    await page.getByLabel('Job Name (Optional)').fill('My New Test Job');
    await page.getByRole('textbox', { name: 'Session Prompts' }).fill('A new test prompt');
    await page.getByLabel('Number of sessions').fill('1');

    // Select Repository
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'test-owner/test-repo' }).click();

    // Select Branch
    await page.getByRole('combobox').last().click();
    await page.getByRole('option', { name: 'main' }).click();

    // Create Job
    await page.getByRole('button', { name: 'Create Job' }).click();

    // Check for the new job name
    await expect(page.getByText('My New Test Job')).toBeVisible();

    // Check for the job creation time (e.g., "a few seconds ago")
    await expect(page.getByText(/ago/)).toBeVisible();

    // The job accordion should be present
    const jobAccordion = page.locator('[data-state="closed"]').first();
    await expect(jobAccordion).toBeVisible();

    // Click the job to expand it
    await page.getByText('My New Test Job').click();

    // Check if the session title is visible
    await expect(page.getByText('A new test prompt')).toBeVisible();
  });
});
