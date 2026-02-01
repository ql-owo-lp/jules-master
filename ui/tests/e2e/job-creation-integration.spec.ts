
import { test, expect } from '@playwright/test';

test.describe('Job Creation with JULES_API_KEY', () => {
  // We do NOT mock the API key in localStorage.
  // We expect it to be passed via EnvProvider from process.env.JULES_API_KEY

  test('should allow creating a job when JULES_API_KEY is present in env', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');

    await page.getByRole('button', { name: 'New Job' }).first().click();

    await expect(page.getByRole('heading', { name: 'Create a New Job' })).toBeVisible();

    const createButton = page.getByRole('button', { name: 'Create Job' });

    // Fill fields to enable the button (if api key is present)
    await page.getByLabel('Job Name (Optional)').fill('Integration Test Job');
    await page.getByRole('textbox', { name: 'Session Prompts' }).fill('Integration Test Prompt');
    await page.getByLabel('Number of sessions').fill('1');

    // Wait for skeleton to disappear and repo to be loaded
    await expect(page.locator('#repository-skeleton')).toBeHidden({ timeout: 10000 });

    // Select Repository (Mock Data or Real Data depending on backend)
    // We use the seeded repo 'test/repo'
    const repoCombobox = page.getByRole('combobox').filter({ hasText: /test\/repo/ }).first();
    await expect(repoCombobox).toBeVisible();

    // Select Branch
    const branchCombobox = page.getByRole('combobox').filter({ hasText: /main/ }).first();
    await branchCombobox.click();
    await page.getByRole('option', { name: 'main' }).click();

    // Now check if Create Button is enabled.
    // It should be enabled if API key is present.
    await expect(createButton).toBeEnabled({ timeout: 5000 });

    await createButton.click();

    // Verify job submitted toast or redirection
    // The message might be "Background Job Scheduled" if background job is selected (default)
    // or "Job submitted!" if not.
    const toastMessage = page.getByText(/Job submitted!|Background Job Scheduled/).first();
    await expect(toastMessage).toBeVisible();
  });
});
