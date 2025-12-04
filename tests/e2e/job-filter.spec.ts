
import { test, expect } from '@playwright/test';

test.describe('Job Filter', () => {
  test('should filter sessions by jobId in the URL', async ({ page }) => {
    // Mock the API calls
    await page.route('**/api/sessions', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'session-1',
            title: 'Test Job',
            prompt: 'Test Prompt',
            state: 'PENDING',
            createdAt: new Date().toISOString(),
          },
        ]),
      });
    });
    await page.route('**/api/jobs', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'job-1',
            name: 'Test Job',
            sessionIds: ['session-1'],
            createdAt: new Date().toISOString(),
            repo: 'test/repo',
            branch: 'main',
          },
        ]),
      });
    });

    // Set the apiKey in the local storage
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
    });

    // Navigate to the new job page
    await page.goto('/jobs/new');

    // Wait for the job creation form to be visible
    await page.waitForSelector('[data-testid="job-creation-form"]');

    // Fill in the form to create a new job
    await page.fill('[data-testid="job-name"]', 'Test Job');
    await page.fill('[data-testid="prompts"]', 'Test Prompt');
    await page.click('button:has-text("Create Job")');

    // Wait for the job filter to be visible
    await page.waitForSelector('[data-testid="job-filter"]');

    // Verify that the URL contains the jobId
    await expect(page).toHaveURL(/\/\?jobId=.*/);

    // Verify that the job filter is set to the new job
    await expect(page.locator('[data-testid="job-filter"]')).toHaveText('Test Job');

    // Verify that only the sessions for the new job are displayed
    await page.waitForSelector('[data-testid="session-card"]');
    const sessionCount = await page.locator('[data-testid="session-card"]').count();
    expect(sessionCount).toBe(1);
  });
});
