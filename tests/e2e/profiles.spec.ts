
import { test, expect } from '@playwright/test';

test.describe('Profiles Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings?tab=profiles');
  });

  test('should create, rename, and delete a profile', async ({ page }) => {
    // Create
    await page.click('button:has-text("Add New Profile")');
    await page.fill('input[id="name"]', 'Test Profile');
    await page.click('button:has-text("Save")');
    await expect(page.locator('text=Test Profile')).toBeVisible();

    // Rename
    await page.locator('tr:has-text("Test Profile") button').click();
    await page.click('text=Rename');
    await page.fill('input[id="name"]', 'Renamed Profile');
    await page.click('button:has-text("Save")');
    await expect(page.locator('text=Renamed Profile')).toBeVisible();

    // Delete
    await page.locator('tr:has-text("Renamed Profile") button').click();
    await page.click('text=Delete');
    await expect(page.locator('text=Renamed Profile')).not.toBeVisible();
  });

  test('should not allow deleting the last profile', async ({ page }) => {
    await page.locator('tr:has-text("Default") button').click();
    const deleteButton = page.locator('text=Delete');
    await expect(deleteButton).toBeDisabled();
  });
});
