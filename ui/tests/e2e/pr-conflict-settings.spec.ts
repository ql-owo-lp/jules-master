
import { test, expect } from '@playwright/test';

test.describe('PR Conflict Settings', () => {
  test('should allow toggling Close PR on Conflict setting', async ({ page }) => {
    // Mock API to simulate persistence because the CI backend runs with MOCK_API=true
    // which does not persist settings.
    let settings = {
        closePrOnConflictEnabled: false,
        idlePollInterval: 120,
        activePollInterval: 30,
        titleTruncateLength: 50,
        lineClamp: 1,
        sessionItemsPerPage: 10,
        jobsPerPage: 5,
        defaultSessionCount: 10,
        prStatusPollInterval: 60,
        theme: 'system'
    };

    await page.route('/api/settings*', async route => {
        if (route.request().method() === 'GET') {
            await route.fulfill({ json: settings });
        } else if (route.request().method() === 'POST') {
            const postData = route.request().postDataJSON();
            settings = { ...settings, ...postData };
            await route.fulfill({ json: { success: true } });
        } else {
            await route.continue();
        }
    });

    await page.goto('/settings?tab=automation');

    // Locate the toggle. It might be off by default.
    // We search by label "Close PR on Conflict"
    const toggleLabel = page.getByLabel('Close PR on Conflict');
    await expect(toggleLabel).toBeVisible();

    // Get current state
    const isChecked = await toggleLabel.isChecked();
    
    // Toggle it
    await toggleLabel.click();

    // Verify it changed state UI-wise
    if (isChecked) {
        await expect(toggleLabel).not.toBeChecked();
    } else {
        await expect(toggleLabel).toBeChecked();
    }

    // Save
    await page.getByRole('button', { name: 'Save Automation Settings' }).click();

    // Verify toast
    await expect(page.getByText('Settings Saved')).toBeVisible();

    // Reload page to verify persistence
    await page.reload();
    await page.getByRole('tab', { name: 'Automation' }).click(); // Ensure tab is active (URL param should handle it but consistent click is safe)

    // Verify state persists
    const toggleLabelAfterReload = page.getByLabel('Close PR on Conflict');
     if (isChecked) {
        await expect(toggleLabelAfterReload).not.toBeChecked();
    } else {
        await expect(toggleLabelAfterReload).toBeChecked();
    }
  });
});
