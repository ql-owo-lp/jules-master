
import { test, expect } from '@playwright/test';

test.describe('Cron Job Creation', () => {
    test('should create a new cron job with valid schedule', async ({ page }) => {
        await page.goto('/settings');

        // Switch to Cron Jobs tab
        await page.getByRole('tab', { name: 'Cron Jobs' }).click();

        // Click "New Cron Job" button
        await page.getByRole('button', { name: 'New Cron Job' }).click();

        // Fill in the form
        await page.getByLabel('Job Name').fill('Test Cron Job');
        await page.getByLabel('Schedule (Cron Expression)').fill('0 0 * * *'); // Daily
        await page.getByLabel('Session Prompts').fill('Test prompt');

        await page.getByRole('button', { name: 'Create Cron Job' }).click();

        // Check for "Invalid Schedule" toast
        const invalidToast = page.getByText('Invalid Schedule');
        await expect(invalidToast).not.toBeVisible();
    });

    test('should show created cron job in the list', async ({ page }) => {
        const jobName = `Test Job ${Date.now()}`;

        // Mock the API to allow creation and listing
        const jobs: any[] = [];
        await page.route('/api/cron-jobs', async route => {
            if (route.request().method() === 'POST') {
                const data = route.request().postDataJSON();
                const newJob = { ...data, id: 'test-id', createdAt: new Date().toISOString(), enabled: true };
                jobs.push(newJob);
                await route.fulfill({
                    json: newJob
                });
            } else if (route.request().method() === 'GET') {
                 await route.fulfill({
                    json: jobs
                });
            } else {
                await route.continue();
            }
        });

        await page.goto('/settings');
        await page.evaluate(() => {
            const mockSources = [{
                name: "sources/github/owner/repo",
                id: "source-1",
                githubRepo: {
                    owner: "owner",
                    repo: "repo",
                    isPrivate: false,
                    defaultBranch: { displayName: "main" },
                    branches: [{ displayName: "main" }]
                }
            }];
            localStorage.setItem('jules-sources-cache', JSON.stringify(mockSources));
            localStorage.setItem('jules-sources-last-fetch', Date.now().toString());
        });

        await page.reload();
        // Use direct navigation to Cron tab to avoid click flakiness
        await page.goto('/settings?tab=cron');

        // Verify list is initially empty
        await expect(page.getByText('No cron jobs yet')).toBeVisible();

        await page.getByRole('button', { name: 'New Cron Job' }).click();

        await page.getByLabel('Job Name').fill(jobName);
        await page.getByLabel('Schedule (Cron Expression)').fill('0 0 * * *');
        await page.getByLabel('Session Prompts').fill('Test prompt');

        // Select repo
        const repoTrigger = page.locator('#repository');
        await expect(repoTrigger).toBeVisible();
        const text = await repoTrigger.innerText();
        if (text.includes('Select a repository')) {
             await repoTrigger.click();
             await page.keyboard.press('ArrowDown');
             await page.keyboard.press('Enter');
        }
        await expect(repoTrigger).toHaveText(/owner\/repo/);

        await page.getByRole('button', { name: 'Create Cron Job' }).click();

        // Verify that the new cron job appears in the list
        await expect(page.getByText(jobName).first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('0 0 * * *').first()).toBeVisible({ timeout: 10000 });
    });

    test('should show error for invalid schedule', async ({ page }) => {
        await page.goto('/settings');
        await page.getByRole('tab', { name: 'Cron Jobs' }).click();
        await page.getByRole('button', { name: 'New Cron Job' }).click();

        await page.getByLabel('Job Name').fill('Invalid Job');
        await page.getByLabel('Schedule (Cron Expression)').fill('invalid-cron');
        await page.getByLabel('Session Prompts').fill('Test prompt');

        await page.getByRole('button', { name: 'Create Cron Job' }).click();

        // Use exact match or look for the title within the toast
        await expect(page.getByText('Invalid Schedule', { exact: true })).toBeVisible();
    });
});
