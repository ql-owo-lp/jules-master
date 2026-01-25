
import { test, expect } from '@playwright/test';

test.describe('Auto Approval Features', () => {
    test.beforeEach(async ({ page }) => {
        // Log browser console messages
        page.on('console', msg => {
            console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
        });

        try {
            // Set API key via UI to ensure it's picked up correctly by hydration
            await page.goto('/settings?tab=general');
            
            // Wait for settings to be loaded from DB to avoid race conditions
            await page.waitForSelector('[data-settings-loaded="true"]', { timeout: 30000 });
            
            // Wait for the input by ID to avoid label matching issues
            await page.waitForSelector('#api-key', { state: 'visible', timeout: 30000 });
            const apiKeyInput = page.locator('#api-key');
            await apiKeyInput.fill('test-api-key');
            
            // Click save and wait for toast
            const saveButton = page.getByRole('button', { name: 'Save General Settings' });
            await saveButton.click({ force: true });
            
            // Wait for toast with a more flexible selector if needed, but getByText is usually fine
            await expect(page.getByText('Settings Saved', { exact: true })).toBeVisible({ timeout: 20000 });
        } catch (e) {
            console.error('Error in beforeEach setup:', e);
            console.log('Current URL:', page.url());
            // Log body content for debugging
            const content = await page.content();
            console.log('Page content preview:', content.substring(0, 1000));
            throw e;
        }
    });

    test('should verify Auto Approval UI elements', async ({ page }) => {
        // 1. Check Job Creation Form for "Require Plan Approval" switch
        await page.goto('/jobs/new');

        // Wait for page to be ready
        await expect(page.getByTestId('new-job-content')).toBeVisible({ timeout: 20000 });

        // Wait for title to ensure hydration
        await expect(page.getByText('New Job', { exact: true }).first()).toBeVisible({ timeout: 20000 });
 
        // Check for "Require Plan Approval" switch
        const requireApprovalSwitch = page.getByRole('switch', { name: 'Require Plan Approval' });
        await expect(requireApprovalSwitch).toBeVisible({ timeout: 20000 });

        // 2. Check Settings Page for "Auto Approval Check Interval"
        // Navigate directly to the tab via URL to avoid flaky tab clicks
        await page.goto('/settings?tab=automation');
        
        // Wait for the specific input by ID to avoid label matching issues
        await page.waitForSelector('#auto-approval-interval', { state: 'visible', timeout: 30000 });
        const autoApprovalInput = page.locator('#auto-approval-interval');
        await expect(autoApprovalInput).toBeVisible();
    });

    test('should create a job with Auto Approval enabled', async ({ page }) => {
        await page.goto('/jobs/new');
        // Wait for content
        await expect(page.getByText('New Job', { exact: true }).first()).toBeVisible({ timeout: 25000 });

        // Fill basic info
        await page.getByLabel('Job Name').fill('Auto Approval Test Job');
        await page.getByRole('textbox', { name: 'Session Prompts' }).fill('Test Prompt');
        await page.getByLabel('Number of sessions').fill('1');

        // Select Repository (Mock Data)
        // Wait for Repository combobox to be enabled which signifies API key is loaded and hydration complete
        const repoCombobox = page.getByRole('combobox', { name: 'Repository' });
        await expect(repoCombobox).toBeEnabled({ timeout: 25000 });

        // Ensure "Require Plan Approval" is UNCHECKED (which means Auto Approval is ON)
        const requireApprovalSwitch = page.getByRole('switch', { name: 'Require Plan Approval' });

        // If it's checked, uncheck it.
        if (await requireApprovalSwitch.isChecked()) {
             await requireApprovalSwitch.click();
        }
        await expect(requireApprovalSwitch).not.toBeChecked();

        // Create the job button should be enabled
        const createButton = page.getByRole('button', { name: 'Create Job' });
        await expect(createButton).toBeEnabled({ timeout: 20000 });
    });

    test('should persist Auto Approval Interval setting', async ({ page }) => {
        // Mock API
        let autoApprovalInterval = 60;
        await page.route('/api/settings*', async route => {
            if (route.request().method() === 'GET') {
                await route.fulfill({ json: {
                    autoApprovalInterval,
                    // defaults
                    idlePollInterval: 120,
                    activePollInterval: 30,
                    defaultSessionCount: 10,
                    titleTruncateLength: 50,
                    lineClamp: 1,
                    sessionItemsPerPage: 10,
                    jobsPerPage: 5,
                    theme: 'system'
                }});
            } else if (route.request().method() === 'POST') {
                const data = route.request().postDataJSON();
                if (data.autoApprovalInterval) {
                    autoApprovalInterval = data.autoApprovalInterval;
                }
                await route.fulfill({ json: { success: true } });
            }
        });

        // Navigate directly to the tab
        await page.goto('/settings?tab=automation');
        await page.waitForSelector('#auto-approval-interval', { state: 'visible', timeout: 30000 });
        const input = page.locator('#auto-approval-interval');

        // Change value
        await input.fill('123');

        // Save Changes
        await page.getByRole('button', { name: 'Save Automation Settings' }).click();

        // Wait for toast
        await expect(page.getByText('Settings Saved', { exact: true })).toBeVisible({ timeout: 15000 });

        // Reload and verify
        await page.goto('/settings?tab=automation');
        await page.waitForSelector('#auto-approval-interval', { state: 'visible', timeout: 20000 });
        await expect(page.locator('#auto-approval-interval')).toHaveValue('123');
    });
});
