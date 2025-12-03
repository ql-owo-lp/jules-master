
import { test, expect } from "@playwright/test";

test("Filters should be preserved after viewing a session", async ({ page }) => {
  await page.goto("/");

  // Mock jobs and sessions data
  await page.evaluate(() => {
    window.localStorage.setItem("jules-jobs", JSON.stringify([
      { id: "job-1", name: "Job 1", sessionIds: ["session-1"], repo: "test/repo1", branch: "main" },
      { id: "job-2", name: "Job 2", sessionIds: ["session-2"], repo: "test/repo2", branch: "main" },
    ]));
    window.localStorage.setItem("jules-sessions", JSON.stringify([
      { id: "session-1", title: "Session 1", state: "COMPLETED", createTime: new Date().toISOString() },
      { id: "session-2", title: "Session 2", state: "RUNNING", createTime: new Date().toISOString() },
    ]));
    window.localStorage.setItem("jules-last-updated-at", Date.now().toString());
  });

  await page.goto("/?repo=test%2Frepo1&status=COMPLETED");

  // Wait for the main content to be visible
  await expect(page.locator('h1:has-text("Jules Master")')).toBeVisible();

  // Verify that the filters are applied
  await expect(page.getByText("Job 1")).toBeVisible();
  await expect(page.getByText("Job 2")).not.toBeVisible();
  await expect(page.locator('button[name="filter-repo"]')).toContainText('test/repo1');
  await expect(page.locator('button[name="filter-status"]')).toContainText('COMPLETED');

  // Open the accordion for Job 1
  await page.getByText('Job 1').click();

  // Click on the session row for "Session 1"
  await page.getByText("Session 1").click();

  await page.waitForURL(/.*\/sessions\/session-1\?jobId=job-1/);

  // Check that the URL is correct
  await expect(page).toHaveURL(/.*\/sessions\/session-1\?jobId=job-1/);

  // Go back to the main page
  await page.goBack();

  // Wait for the main content to be visible
  await expect(page.locator('h1:has-text("Jules Master")')).toBeVisible();

  // Verify that the filters are still applied in the UI state
  await expect(page.locator('button[name="filter-repo"]')).toContainText('test/repo1');
  await expect(page.locator('button[name="filter-status"]')).toContainText('COMPLETED');

  // Verify that the job list is still filtered
  await expect(page.getByText("Job 1")).toBeVisible();
  await expect(page.getByText("Job 2")).not.toBeVisible();
});
