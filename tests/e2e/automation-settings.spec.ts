
import { test, expect } from '@playwright/test';

test.describe('Automation Settings', () => {
  test('should display and update Auto Retry settings', async ({ page }) => {
    await page.goto('/');

    // Open settings sheet
    await page.getByRole('button', { name: 'Open settings' }).click();

    // Check if the setting checkbox is visible and checked by default
    const autoRetryCheckbox = page.getByLabel('Enable Auto Retry');
    await expect(autoRetryCheckbox).toBeVisible();
    await expect(autoRetryCheckbox).toBeChecked();

    // Check if the setting textarea is visible and has the default value
    const autoRetryTextarea = page.getByLabel('Auto Retry Message');
    await expect(autoRetryTextarea).toBeVisible();
    await expect(autoRetryTextarea).toHaveValue('You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution');

    // Update value
    await autoRetryTextarea.fill('New auto retry message');

    // Uncheck the checkbox
    await autoRetryCheckbox.uncheck();

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Verify toast
    await expect(page.getByText('Settings Saved', { exact: true })).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByLabel('Enable Auto Retry')).not.toBeChecked();
    await expect(page.getByLabel('Auto Retry Message')).toHaveValue('New auto retry message');
  });

  test('should display and update Auto Continue settings', async ({ page }) => {
    await page.goto('/');

    // Open settings sheet
    await page.getByRole('button', { name: 'Open settings' }).click();

    // Check if the setting checkbox is visible and unchecked by default
    const autoContinueCheckbox = page.getByLabel('Enable Auto Continue');
    await expect(autoContinueCheckbox).toBeVisible();
    await expect(autoContinueCheckbox).not.toBeChecked();

    // Check if the setting textarea is visible and has the default value
    const autoContinueTextarea = page.getByLabel('Auto Continue Message');
    await expect(autoContinueTextarea).toBeVisible();
    await expect(autoContinueTextarea).toHaveValue('Sounds good. Now go ahead finish the work');

    // Check the checkbox
    await autoContinueCheckbox.check();

    // Update value
    await autoContinueTextarea.fill('New auto continue message');

    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Verify toast
    await expect(page.getByText('Settings Saved', { exact: true })).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.getByLabel('Enable Auto Continue')).toBeChecked();
    await expect(page.getByLabel('Auto Continue Message')).toHaveValue('New auto continue message');
  });
});
