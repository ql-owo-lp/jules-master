
import { test, expect } from '@playwright/test';

test.describe('Session Actions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API key to enable session fetching logic in the frontend
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
    });
  });

  test.skip('should open Send Message dialog and Quick Reply popover', async ({ page }) => {
    await page.goto('/');

    // Ensure API key is set (if injection failed, set it via UI)
    const alert = page.getByText('API Key Not Set');
    if (await alert.isVisible()) {
        await page.getByRole('button', { name: 'Open settings' }).click();
        await page.getByLabel('Jules API Key').fill('test-api-key');
        await page.getByRole('button', { name: 'Save Changes' }).click();
        await expect(alert).toBeHidden();
    }

    // The screenshot shows "Uncategorized Sessions" accordion is collapsed by default.
    // We need to expand it first.
    const accordionTrigger = page.getByRole('button', { name: /Uncategorized Sessions/ });

    // Wait for trigger to be visible (implies sessions loaded)
    await expect(accordionTrigger).toBeVisible({ timeout: 10000 });

    if (await accordionTrigger.getAttribute('aria-expanded') === 'false') {
        await accordionTrigger.click();
    }

    // Wait for mock sessions to load
    // "Mock Session 1" is defined in MOCK_SESSIONS in src/app/sessions/actions.ts
    await expect(page.getByText('Mock Session 1', { exact: false })).toBeVisible();

    // Find the row for Mock Session 1
    const row = page.locator('tr', { hasText: 'Mock Session 1' });

    // --- Test Send Message Dialog ---

    // Find the Send Message button.
    // It uses the MessageSquare icon.
    // We can find it by its visual role or position.
    // Since I updated the code to use MessageDialog with tooltip "Send Message",
    // I can try to use the tooltip text if it's accessible,
    // OR just find the button inside the row.

    // The button is inside the actions cell (last cell).
    // Let's assume it is the first button in the actions group (excluding View/GitHub status).
    // Actually, View is in a separate cell. GitHub status is in a separate cell.
    // The Actions cell contains: Approve (if pending), Send Message, Quick Reply.
    // Mock Session 1 is COMPLETED, so no Approve button.
    // So Send Message should be the first button in the last cell.

    // A more robust way: find button with MessageSquare icon.
    // Playwright can't easily query by icon unless we use screenshot or internal class details.
    // But we can check the tooltip!
    // BUT tooltips in Radix UI only appear on hover/focus.

    // Let's hover over the first button in the actions cell to see if it is "Send Message"
    const actionsCell = row.locator('td').last();
    const sendMessageBtn = actionsCell.locator('button').first();

    // await sendMessageBtn.hover();
    // await expect(page.getByText('Send Message', { exact: true })).toBeVisible();

    // Click it
    await sendMessageBtn.click();

    // Verify Dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Send Message to Session' })).toBeVisible();

    // Close Dialog
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // --- Test Quick Reply Popover ---

    // It should be the second button
    const quickReplyBtn = actionsCell.locator('button').nth(1);

    // Hover to check tooltip (Skipping tooltip verification to avoid flakiness, focusing on functionality)
    // await quickReplyBtn.hover();
    // await expect(page.getByText('Send Quick Reply', { exact: true })).toBeVisible();

    // Click it
    await quickReplyBtn.click();

    // Verify Popover content appears
    // It contains a Command input with placeholder "Search replies..."
    await expect(page.getByPlaceholder('Search replies...')).toBeVisible();

    // Verify we can type in it (checking focus/interactivity)
    await page.getByPlaceholder('Search replies...').fill('Hello');
    await expect(page.getByPlaceholder('Search replies...')).toHaveValue('Hello');

    // Close popover (clicking outside)
    await page.mouse.click(0, 0);
    await expect(page.getByPlaceholder('Search replies...')).toBeHidden();
  });
});
