
import { test, expect } from "@playwright/test";

test("Job filter should be case-insensitive and preserved after viewing a session", async ({ page }) => {
  await page.goto("/");

  // Mock jobs and sessions data
  await page.evaluate(() => {
    window.localStorage.setItem("jules-jobs", JSON.stringify([
      { id: "job-1", name: "Job 1", sessionIds: ["session-1"], repo: "test/repo", branch: "main" },
      { id: "job-2", name: "Job 2", sessionIds: ["session-2"], repo: "test/repo", branch: "main" },
    ]));
    window.localStorage.setItem("jules-sessions", JSON.stringify([
      { id: "session-1", title: "Session 1", state: "COMPLETED", createTime: new Date().toISOString() },
      { id: "session-2", title: "Session 2", state: "COMPLETED", createTime: new Date().toISOString() },
    ]));
    window.localStorage.setItem("jules-last-updated-at", Date.now().toString());
  });

  await page.goto("/?q=job+1");

  // Check that only Job 1 is visible (case-insensitive)
  await expect(page.getByText('Job 1')).toBeVisible();
  await expect(page.getByText('Job 2')).not.toBeVisible();

  // Open the accordion for Job 1
  await page.getByText('Job 1').click();

  // Click on the session row for "Session 1"
  await page.getByText("Session 1").click();

  // Wait for navigation and check URL
  await page.waitForURL(/.*\/sessions\/session-1\?jobId=job-1/);
  await expect(page).toHaveURL(/.*\/sessions\/session-1\?jobId=job-1/);

  // Go back to the jobs list
  await page.goBack();

  // Check that the filter is still applied
  await expect(page.getByText('Job 1')).toBeVisible();
  await expect(page.getByText('Job 2')).not.toBeVisible();
});
