
import { test, expect } from '@playwright/test';
import { createCronJob } from '@/app/settings/actions';

test.describe('Cron Job History', () => {
    test.beforeEach(async ({ page }) => {
        await createCronJob({
            name: 'Test Cron Job',
            schedule: '* * * * *',
            prompt: 'Test Prompt',
            repo: 'test/repo',
            branch: 'main',
            autoApproval: false,
            automationMode: 'full-auto',
            requirePlanApproval: false,
            sessionCount: 1,
        });
        await page.goto('/settings');
    });

    test('should display cron job history', async ({ page }) => {
        await page.getByRole('tab', { name: 'Cron Jobs' }).click();
        await page.waitForSelector('table');
        await page.getByTestId('cron-job-actions-trigger').first().click();
        await page.getByRole('menuitem', { name: 'View History' }).click();
        await expect(page.getByRole('heading', { name: 'History for Test Cron Job' })).toBeVisible();
    });
});
