
import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API key so the app tries to fetch sessions
    // Also mock localStorage for sessions to ensure test robustness against API mocking issues
    await page.goto('/'); // Navigate first to set localStorage
    await page.evaluate(() => {
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
      window.localStorage.setItem('jules-sessions', JSON.stringify([
        {
            id: 'mock-1',
            title: 'Mock Session 1',
            state: 'COMPLETED',
            createTime: new Date().toISOString(),
            url: 'http://example.com/1',
            outputs: []
        },
        {
            id: 'mock-2',
            title: 'Mock Session 2',
            state: 'AWAITING_USER_FEEDBACK',
            createTime: new Date().toISOString(),
            url: 'http://example.com/2',
            outputs: []
        }
      ]));
      window.localStorage.setItem('jules-jobs', JSON.stringify([
         {
             id: 'job-1',
             name: 'Job 1',
             repo: 'repo/1',
             branch: 'main',
             sessionIds: ['mock-1', 'mock-2']
         }
      ]));
    });
  });

  test('should display mocked sessions', async ({ page }) => {
    // Reload to apply localStorage
    await page.reload();

    // Check for mock session titles
    // Accordion must be open or we search for text. The text should be in the DOM even if collapsed?
    // No, Accordion content is hidden/unmounted.
    // The test earlier assumed "Mock Session 1" is visible.
    // SessionList by default does NOT open accordions unless jobId param is present.
    // But unclassified sessions are in "Uncategorized".
    // The test "should display mocked sessions" implies they should be visible.
    // I injected a job 'Job 1'. The accordion for 'Job 1' will be closed by default.

    // I should click the job to expand it.
    await page.click('text=Job 1');

    await expect(page.getByText('Mock Session 1', { exact: false })).toBeVisible();
    await expect(page.getByText('Mock Session 2', { exact: false })).toBeVisible();

    // Check for status badges (UI labels)
    await expect(page.getByText('Completed', { exact: true })).toBeVisible();
    await expect(page.getByText('Awaiting User Feedback', { exact: true })).toBeVisible();
  });

  test('should allow setting API key', async ({ page }) => {
    // Clear API key for this test
    await page.addInitScript(() => {
       window.localStorage.removeItem('jules-api-key');
    });
    await page.goto('/');

    // Click settings (Header component)
    await page.getByRole('button', { name: 'Open settings' }).click();

    // Fill API Key
    const apiKeyInput = page.getByLabel('Jules API Key');
    await apiKeyInput.fill('new-test-api-key');

    // Save
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Verify alert is gone
    await expect(page.getByText('API Key Not Set')).toBeHidden();
  });

  test('should filter sessions', async ({ page }) => {
     await page.goto('/');

     // Check if filter inputs are present
     await expect(page.getByText('Repository', { exact: true })).toBeVisible(); // Label
     await expect(page.getByText('Session Status', { exact: true })).toBeVisible(); // Label
     await expect(page.getByText('Job Name', { exact: true })).toBeVisible(); // Label
  });
});
