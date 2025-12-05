
import { test, expect } from '@playwright/test';

test.describe('Settings Persistence', () => {
  test('should load settings from profile', async ({ page }) => {
    // Mock Profile API
    await page.route('/api/profiles', async route => {
        await route.fulfill({ json: [{
            id: 'test-profile-id',
            name: 'Test Profile',
            julesApiKey: 'test-api-key',
            createdAt: new Date().toISOString(),
            idlePollInterval: 120,
            activePollInterval: 30,
            defaultSessionCount: 15,
            theme: 'dark'
        }] });
    });

    await page.goto('/settings');

    // Wait for profile to load
    await expect(page.getByText('Test Profile')).toBeVisible();

    // Switch to General tab
    await page.getByRole('tab', { name: 'General' }).click();

    // Expect DB value (15)
    await expect(page.getByLabel('Default Session Count for New Jobs')).toHaveValue('15');
    await expect(page.getByLabel('Idle Poll Interval (seconds)')).toHaveValue('120');

    // Expect Theme (dark) - verify html class
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('should save settings to profile', async ({ page }) => {
    // Mock Profile API
    await page.route('/api/profiles', async route => {
        if (route.request().method() === 'GET') {
            await route.fulfill({ json: [{
                id: 'test-profile-id',
                name: 'Test Profile',
                julesApiKey: 'test-api-key',
                createdAt: new Date().toISOString(),
                defaultSessionCount: 10,
                idlePollInterval: 120,
            }] });
        } else if (route.request().method() === 'POST') {
             // Create profile
             await route.fulfill({ json: { id: 'new-id', name: 'New Profile' } });
        }
    });

    // Intercept PATCH to verify save
    let patchCalled = false;
    await page.route('/api/profiles/test-profile-id', async route => {
        if (route.request().method() === 'PATCH') {
            const body = route.request().postDataJSON();
            if (body.defaultSessionCount === 7 && body.idlePollInterval === 123) {
                patchCalled = true;
                await route.fulfill({ json: { success: true } });
            } else {
                await route.fulfill({ status: 500 });
            }
        } else {
            await route.fallback();
        }
    });

    await page.goto('/settings');
    await expect(page.getByText('Test Profile')).toBeVisible();

    // Switch to General tab
    await page.getByRole('tab', { name: 'General' }).click();

    await page.getByLabel('Default Session Count for New Jobs').fill('7');
    await page.getByLabel('Idle Poll Interval (seconds)').fill('123');

    // Save General Settings
    await page.getByRole('button', { name: 'Save General Settings' }).click();

    await expect(page.getByText('Settings Saved', { exact: true })).toBeVisible();

    // Verify PATCH was called
    expect(patchCalled).toBe(true);
  });
});
