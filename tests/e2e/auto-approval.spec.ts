
import { test, expect } from '@playwright/test';

test.describe('Auto Approval Features', () => {
    test.beforeEach(async ({ page }) => {
        // Mock API key to ensure form is enabled
        await page.addInitScript(() => {
            window.localStorage.setItem('jules-api-key', '"test-api-key"');
        });
    });

    test('should verify Auto Approval UI elements', async ({ page }) => {
        // 1. Check Job Creation Form for "Require Plan Approval" switch
        await page.goto('/jobs/new');

        // Wait for form to be ready - matching the snapshot structure
        // Using text because "New Job" is inside a generic container that looks like a title but isn't a heading role
        await expect(page.getByText('New Job', { exact: true })).toBeVisible();

        // Check for "Require Plan Approval" switch
        const requireApprovalLabel = page.getByLabel('Require Plan Approval');
        await expect(requireApprovalLabel).toBeVisible();

        // 2. Check Settings Page for "Auto Approval Check Interval"
        await page.goto('/');
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();

        // Check for Auto Approval Interval input
        const autoApprovalInput = page.getByLabel('Auto Approval Check Interval (seconds)');
        await expect(autoApprovalInput).toBeVisible();
    });

    test('should persist Auto Approval Interval setting', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('button', { name: 'Open settings' }).click();

        const input = page.getByLabel('Auto Approval Check Interval (seconds)');
        await expect(input).toBeVisible();

        // Change value
        await input.fill('120');

        // Save Changes
        await page.getByRole('button', { name: 'Save Changes' }).click();

        // Wait for toast or dialog close
        await expect(page.getByText('Settings Saved', { exact: true })).toBeVisible();

        // Reload and verify
        await page.reload();
        await page.getByRole('button', { name: 'Open settings' }).click();
        await expect(page.getByLabel('Auto Approval Check Interval (seconds)')).toHaveValue('120');
    });
});
