
import { test, expect } from '@playwright/test';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

test.describe('Settings Persistence', () => {
  test('should save settings to database', async ({ page }) => {
    // Long test, increase timeout
    test.setTimeout(60000);

    await page.goto('/settings?tab=general');
    await page.getByLabel('Default Session Count for New Jobs').fill('25');
    await page.getByLabel('Idle Poll Interval (seconds)').fill('200');
    await page.getByRole('button', { name: 'Save General Settings' }).click();
    await expect(page.getByText('Settings Saved')).toBeVisible();

    await page.goto('/settings?tab=automation');
    await page.getByLabel('Auto Continue Completed Sessions').uncheck();
    await page.getByLabel('Auto Retry Failed Sessions').uncheck();
    await page.getByLabel('Auto Delete Stale Branches').check();
    await page.getByLabel('Auto Delete Stale Branches After (days)').fill('5');
    await page.getByRole('button', { name: 'Save Automation Settings' }).click();
    await expect(page.getByText('Settings Saved')).toBeVisible();


    // Reload the page and verify
    await page.reload();

    // General tab verification
    await page.goto('/settings?tab=general');
    await expect(page.getByLabel('Default Session Count for New Jobs')).toHaveValue('25');
    await expect(page.getByLabel('Idle Poll Interval (seconds)')).toHaveValue('200');

    // Automation tab verification
    await page.goto('/settings?tab=automation');
    await expect(page.getByLabel('Auto Continue Completed Sessions')).not.toBeChecked();
    await expect(page.getByLabel('Auto Retry Failed Sessions')).not.toBeChecked();
    await expect(page.getByLabel('Auto Delete Stale Branches')).toBeChecked();
    await expect(page.getByLabel('Auto Delete Stale Branches After (days)')).toHaveValue('5');

    // Clean up
    const activeProfile = await db.query.profiles.findFirst({ where: eq(profiles.isActive, true) });
    if(activeProfile) {
      await db.delete(profiles).where(eq(profiles.id, activeProfile.id));
    }
  });
});
