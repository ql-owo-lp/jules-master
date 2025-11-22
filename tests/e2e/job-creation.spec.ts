
import { test, expect } from '@playwright/test';

test.describe('Job Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API key to ensure form is enabled
    // Also inject sources cache to avoid waiting for API/Server Action
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
      window.localStorage.setItem('jules-sources-cache', JSON.stringify([
         {
            name: 'github/test-owner/test-repo',
            id: 'source-1',
            githubRepo: {
              owner: 'test-owner',
              repo: 'test-repo',
              isPrivate: false,
              branches: [
                { displayName: 'main' },
                { displayName: 'develop' },
              ],
              defaultBranch: { displayName: 'main' },
            },
          }
      ]));
    });
  });

  test('should open new job dialog and fill form with mock data', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'New Job' }).click();

    await expect(page.getByRole('heading', { name: 'Create a New Job' })).toBeVisible();

    // Fill fields
    await page.getByLabel('Job Name').fill('Test Job');
    await page.getByRole('textbox', { name: 'Session Prompts' }).fill('Test Prompt');
    await page.getByLabel('Number of sessions').fill('1');

    // Select Repository from Mock Data
    // Wait for skeleton to disappear
    await expect(page.locator('#repository-skeleton')).toBeHidden({ timeout: 10000 });

    // Check if error appeared
    const error = page.locator('#repository-error');
    if (await error.isVisible()) {
        console.log('Repository Error:', await error.innerText());
    }
    await expect(error).toBeHidden();

    // If mock API is enabled, it should load sources instantly.
    // However, if the test fails here, it means sources are not loading.
    // Ensure SourceSelection component is handling loading state correctly.

    // The mock data has "github/test-owner/test-repo"
    // Since SourceSelection auto-selects the first source, the combobox label will change to the repo name.

    // We select the repo
    const repoCombobox = page.getByRole('combobox').nth(0);
    await expect(repoCombobox).toBeEnabled();

    // If not auto-selected, click and select
    const text = await repoCombobox.innerText();
    if (!text.includes('test-owner/test-repo')) {
        await repoCombobox.click();
        await page.getByRole('option', { name: 'test-owner/test-repo' }).click();
    }

    await expect(repoCombobox).toHaveText(/test-owner\/test-repo/);

    // Select Branch
    const branchCombobox = page.getByRole('combobox').nth(1);
    await expect(branchCombobox).toBeVisible();

    // Wait for it to be enabled (implies source is selected)
    await expect(branchCombobox).toBeEnabled();

    // Verify 'main' is selected (default branch)
    await expect(branchCombobox).toHaveText(/main/);

    await branchCombobox.click();
    await expect(page.getByRole('option', { name: 'main' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'develop' })).toBeVisible();
    await page.getByRole('option', { name: 'develop' }).click(); // Switch to develop

    // Check submit button
    const createButton = page.getByRole('button', { name: 'Create Job' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
  });

  test('should navigate to new job page via external link', async ({ page }) => {
     await page.goto('/');
     const newJobLink = page.locator('a[href="/jobs/new"]');
     await expect(newJobLink).toBeVisible();
  });
});
