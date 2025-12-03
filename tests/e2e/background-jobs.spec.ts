
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dbPath = path.join(process.cwd(), 'data', 'sqlite.db');

test.describe('Background Jobs Progress', () => {
  let jobId = 'e2e-progress-job';

  test.beforeAll(() => {
    // Ensure DB exists
    if (!fs.existsSync(dbPath)) {
        throw new Error('Database not found. Please run the app first.');
    }

    // Direct DB manipulation to setup test state
    const db = new Database(dbPath);

    // Clean up
    db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);

    // Create a PROCESSING job
    db.prepare(`
      INSERT INTO jobs (id, name, session_ids, created_at, repo, branch, status, session_count, prompt, background)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jobId,
      'E2E Progress Job',
      JSON.stringify(['s1', 's2']), // 2 created
      new Date().toISOString(),
      'owner/repo',
      'main',
      'PROCESSING',
      10, // Total 10
      'Prompt',
      1 // true
    );

    db.close();
  });

  test.afterAll(() => {
    const db = new Database(dbPath);
    db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
    db.close();
  });

  test('should display progress bar for processing jobs', async ({ page }) => {
    // 1. Navigate to homepage
    await page.goto('/');

    // Clear local storage to force refresh from DB
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for the page to settle and hydration
    await page.waitForTimeout(1000);

    // Click refresh button to be sure
    const refreshBtn = page.getByRole('button', { name: 'Refresh job list' });
    if (await refreshBtn.isVisible()) {
        await refreshBtn.click();
        await page.waitForTimeout(1000);
    }

    // 2. Find the job accordion item
    const jobHeader = page.getByText('E2E Progress Job');
    await expect(jobHeader).toBeVisible();

    // Expand if needed (it might be collapsed)
    await jobHeader.click();

    // 3. Verify Progress Bar
    // Look for text "Creating Sessions..."
    await expect(page.getByText('Creating Sessions...')).toBeVisible();

    // Look for count "2 / 10"
    await expect(page.getByText('2 / 10')).toBeVisible();

    // Verify progress bar element exists (role 'progressbar')
    const progressSection = page.locator('.px-4.py-3.bg-muted\\/20');
    await expect(progressSection).toBeVisible();
    await expect(progressSection.getByRole('progressbar')).toBeVisible();
  });
});
