
import { test, expect } from '@playwright/test';

test.describe.serial('Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings?tab=profiles');
  });

  test('should create a new profile', async ({ page }) => {
    await page.click('button:has-text("Add New")');
    await page.fill('input[id="profile-name"]', 'E2E Test Profile');
    await page.click('button:has-text("Save")');
    await expect(page.locator('text=E2E Test Profile')).toBeVisible();
  });

  test('should rename a profile', async ({ page }) => {
    await page.locator('tr:has-text("E2E Test Profile")').locator('button[aria-haspopup="menu"]').click();
    await page.click('text=Rename');
    await page.fill('input[id="profile-name"]', 'Renamed E2E Profile');
    await page.click('button:has-text("Save")');
    await expect(page.locator('text=Renamed E2E Profile')).toBeVisible();
  });

  test('should delete a profile', async ({ page }) => {
    await page.locator('tr:has-text("Renamed E2E Profile")').locator('button[aria-haspopup="menu"]').click();
    await page.click('text=Delete');
    await expect(page.locator('text=Renamed E2E Profile')).not.toBeVisible();
  });

  test('should not delete the last profile', async ({ page }) => {
    await page.locator('tbody tr:first-child button[aria-haspopup="menu"]').click();
    const deleteButton = page.locator('text=Delete');
    await expect(deleteButton).toBeDisabled();
  });
});
