
import { test, expect } from '@playwright/test';

test.describe('Jobs and Sessions Display', () => {
  test('should display job creation time and sessions under the job', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Inject data into localStorage to simulate existing jobs
    const job = {
        "id": "job-1",
        "name": "Test Job with Time",
        "sessionIds": ["session-1"],
        "createdAt": new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        "repo": "owner/repo",
        "branch": "main",
        "status": "COMPLETED",
        "sessionCount": 1
    };

    const session = {
        "id": "session-1",
        "name": "sessions/session-1",
        "title": "Test Session",
        "state": "COMPLETED",
        "createTime": new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        "prompt": "Test Prompt"
    };

    await page.evaluate(({ job, session }) => {
        localStorage.setItem('jules-jobs', JSON.stringify([job]));
        localStorage.setItem('jules-sessions', JSON.stringify([session]));
        localStorage.setItem('jules-api-key', '"test-api-key"');
    }, { job, session });

    // Reload to pick up changes
    await page.reload();

    // Wait for jobs to load
    await page.waitForSelector('text=Jobs & Sessions');

    // Check if the job is displayed with time
    const jobHeader = page.locator('text=Test Job with Time');
    await expect(jobHeader).toBeVisible();

    // Check for "about 2 hours ago" or "2 hours ago"
    // formatDistanceToNow might output "about 2 hours ago"
    await expect(page.locator('body')).toContainText('2 hours ago');

    // Open the accordion if not open (it should be closed by default unless jobId param is present)
    // Click the trigger
    await jobHeader.click();

    // Check if session is displayed
    const sessionRow = page.locator('text=Test Session');
    await expect(sessionRow).toBeVisible();
  });
});
