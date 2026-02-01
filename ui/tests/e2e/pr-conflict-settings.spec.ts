
import { test, expect } from '@playwright/test';

test.describe('PR Conflict Settings', () => {
    test.beforeEach(async ({ page }) => {
        // Mock API settings response to ensure consistent state if needed, 
        // but for settings persistence test, we usually want to test the full flow including backend.
        // However, we can also rely on the integration test approach where we modify via UI and verify persistence.
    });

  test('should allow toggling Close PR on Conflict setting', async ({ page }) => {
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
    const settingsSavedToast = page.getByText('Settings Saved', { exact: true });
    await expect(settingsSavedToast).toBeVisible();
    await expect(settingsSavedToast).toBeHidden();

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
