
import { test, expect } from '@playwright/test';

test.describe('PR Conflict Settings', () => {
    test.beforeEach(async ({ page }) => {
        // Mock API settings response to ensure consistent state
    });

  test('should allow toggling Close PR on Conflict setting', async ({ page }) => {
    let settings = {
        closePrOnConflictEnabled: false,
    };

    await page.route('/api/settings*', async route => {
        if (route.request().method() === 'GET') {
            await route.fulfill({ json: settings });
        } else if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON();
            settings = { ...settings, ...body };
            await route.fulfill({ json: { success: true } });
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
