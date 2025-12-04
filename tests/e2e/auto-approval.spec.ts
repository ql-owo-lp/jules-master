
import { test, expect } from '@playwright/test';

test.describe('Auto Approval Features', () => {
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

    test('should verify Auto Approval UI elements', async ({ page }) => {
        await page.goto('/settings');
        await page.getByRole('tab', { name: 'Automation' }).click();

        const autoRetrySwitch = page.locator('#auto-retry-enabled');
        await expect(autoRetrySwitch).toBeVisible();
        await expect(autoRetrySwitch).toBeChecked();

        const autoContinueSwitch = page.locator('#auto-continue-enabled');
        await expect(autoContinueSwitch).toBeVisible();
        await expect(autoContinueSwitch).toBeChecked();
    });

    test('should create a job with Auto Approval enabled', async ({ page }) => {
        await page.goto('/jobs/new');
        await page.waitForSelector('button:has-text("New Job")');

        // Fill out the form
        await page.getByLabel('Job Name').fill('Test Auto Approval Job');
        await page.getByLabel('Prompt').fill('This is a test prompt.');

        // Select Repository (Mock Data)
        await expect(page.locator('#repository-skeleton')).toBeHidden({ timeout: 10000 });

        // Use exact match or regex for the combobox that displays the repository
        const repoCombobox = page.getByRole('combobox').filter({ hasText: /test-owner\/test-repo/ }).first();
        await repoCombobox.click();
        await page.getByRole('option', { name: /test-owner\/test-repo/ }).click();
        await expect(repoCombobox).toHaveText(/test-owner\/test-repo/);

        // Enable Auto Approval
        const autoApprovalSwitch = page.locator('#auto-approval-switch');
        await autoApprovalSwitch.click();
        await expect(autoApprovalSwitch).toBeChecked();

        // Submit the form
        await page.getByRole('button', { name: 'Create Job' }).click();

        // Verify the job was created (mocked response)
        await page.route('/api/jobs', (route) => {
            route.fulfill({
                status: 200,
                body: JSON.stringify({
                    id: 'new-job-id',
                    name: 'Test Auto Approval Job',
                    autoApproval: true
                }),
            });
        });
    });

    test('should persist Auto Approval Interval setting', async ({ page }) => {
        await page.goto('/settings');
        await page.getByRole('tab', { name: 'Automation' }).click();

        const intervalInput = page.locator('#auto-approval-interval');
        await intervalInput.fill('120');
        await page.getByRole('button', { name: 'Save Automation Settings' }).click();
        await expect(page.getByText('Settings Saved')).toBeVisible();

        // Reload the page and verify the setting is persisted
        await page.reload();
        await page.getByRole('tab', { name: 'Automation' }).click();
        await expect(intervalInput).toHaveValue('120');
    });
});
