
import { test, expect } from '@playwright/test';

test.describe('Job Creation', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('/api/sources', (route) => {
            route.fulfill({
                status: 200,
                body: JSON.stringify([
                    {
                        "githubRepo": {
                            "owner": "test-owner",
                            "repo": "test-repo"
                        }
                    }
                ]),
            });
        });
    });

    test('should open new job dialog and fill form with mock data', async ({ page }) => {
        await page.goto('/jobs/new');

        // Fill form
        await page.getByLabel('Job Name').fill('Test Job');
        await page.getByLabel('Prompt').fill('Test prompt');

        // Select Repository from Mock Data
        // Wait for skeleton to disappear
        await expect(page.locator('#repository-skeleton')).toBeHidden({ timeout: 10000 });

        // Check if error appeared
        const error = page.locator('#repository-error');
        if (await error.isVisible()) {
            console.error('Repository error:', await error.textContent());
        }

        // Use exact match for the combobox that displays the repository
        const repoCombobox = page.getByRole('combobox').first();
        await repoCombobox.click();
        await page.getByRole('option', { name: /test-owner\/test-repo/ }).click();
        await expect(repoCombobox).toHaveText(/test-owner\/test-repo/);
    });

    test('should navigate to new job page via external link', async ({ page }) => {
        await page.goto('/');
        const newJobLink = page.getByRole('link', { name: 'New Job' });

        // Get the href attribute
        const href = await newJobLink.getAttribute('href');

        // Create a new page in the same context
        const newPage = await page.context().newPage();
        await newPage.goto(href!);

        // Verify the new page URL
        await expect(newPage).toHaveURL('/jobs/new');

        // Close the new page
        await newPage.close();
    });
});
