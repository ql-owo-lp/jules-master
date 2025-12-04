
import { test, expect } from '@playwright/test';

test('Batch Job Creation', async ({ page }) => {
  await page.goto('http://localhost:9002/jobs/new');

  await page.wait_for_selector('textarea[aria-label="Session Prompts"]');

  await page.fill('textarea[aria-label="Session Prompts"]', 'Prompt 1\nPrompt 2\nPrompt 3');

  await page.click('button:has-text("Create Job")');

  await page.waitForURL('http://localhost:9002/');

  expect(await page.isVisible('text="Prompt 1"')).toBe(true);
  expect(await page.isVisible('text="Prompt 2"')).toBe(true);
  expect(await page.isVisible('text="Prompt 3"')).toBe(true);
});
