import { test, expect } from '@playwright/test';

test.describe('Session Action Popups', () => {
  test.beforeEach(async ({ page }) => {
    // Define dummy data
    const sessions = [
      {
        id: "sess-1",
        title: "Test Session 1",
        state: "COMPLETED",
        createTime: "2023-10-27T10:00:00Z",
        url: "http://example.com",
        outputs: []
      }
    ];
    const jobs = [
      {
        id: "job-1",
        name: "Test Job 1",
        repo: "owner/repo",
        branch: "main",
        sessionIds: ["sess-1"]
      }
    ];

    // Navigate to the page first (Playwright requires origin to set localStorage)
    // We can use context.addInitScript to set localStorage before navigation,
    // but we need to match the origin.

    // Go to home page
    await page.goto('/');

    // Inject data
    await page.evaluate(({ sessions, jobs }) => {
        localStorage.setItem('jules-sessions', JSON.stringify(sessions));
        localStorage.setItem('jules-jobs', JSON.stringify(jobs));
    }, { sessions, jobs });

    // Reload to apply data
    await page.reload();

    // Wait for content to load
    await expect(page.locator('text=Test Job 1')).toBeVisible();
  });

  test('should open Send Message dialog', async ({ page }) => {
    // Expand the job
    await page.click('text=Test Job 1');

    // Find the row for "Test Session 1"
    const row = page.locator('tr', { hasText: 'Test Session 1' });
    await expect(row).toBeVisible();

    // The "Send Message" button.
    // We can identify it by the icon. MessageSquare icon.
    // Or since we know the order of buttons in the actions cell.
    // Actions cell is the last cell.
    const actionsCell = row.locator('td').last();

    // We expect:
    // 1. Approve Plan (only if PENDING - not here since COMPLETED)
    // 2. Send Message (MessageSquare icon)
    // 3. Quick Reply (MessageSquareReply icon)

    // So the first button should be Send Message.
    const msgBtn = actionsCell.locator('button').first();

    await msgBtn.click();

    // Check for Dialog
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('text=Send Message to Session')).toBeVisible();

    // Close it
    await page.keyboard.press('Escape');
  });

  test('should open Quick Reply popover with search', async ({ page }) => {
    // Expand the job
    await page.click('text=Test Job 1');

    // Find the row
    const row = page.locator('tr', { hasText: 'Test Session 1' });

    const actionsCell = row.locator('td').last();

    // Quick Reply button is the second button
    const replyBtn = actionsCell.locator('button').nth(1);

    await replyBtn.click();

    // Check for Popover content
    // The popover content is usually rendered in a portal, so it might be at body level.
    // It contains a Command input.
    const searchInput = page.locator('input[placeholder="Search replies..."]');
    await expect(searchInput).toBeVisible();
  });
});
