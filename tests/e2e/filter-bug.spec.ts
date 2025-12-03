
import { test, expect } from "@playwright/test";

test("Job filter should be preserved after viewing a session", async ({ page }) => {
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

  await page.goto("/");

  // Open the accordion for Job 2
  await page.getByText('Job 2').click();

  // Click on the session row for "Session 2"
  await page.getByText("Session 2").click();

  await page.waitForURL(/.*\/sessions\/session-2\?jobId=job-2/);

  // Check that the URL is correct
  await expect(page).toHaveURL(/.*\/sessions\/session-2\?jobId=job-2/);
});

test("Job filter should be correctly displayed when loading with jobId in URL", async ({
  page,
}) => {
  // Mock data to ensure the job and session exist
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "jules-jobs",
      JSON.stringify([
        { id: "job-1", name: "Job 1", sessionIds: ["session-1"] },
      ])
    );
    localStorage.setItem(
      "jules-sessions",
      JSON.stringify([
        { id: "session-1", title: "Session 1", state: "COMPLETED" },
      ])
    );
  });

  // Navigate to the page with a jobId in the query params
  await page.goto("/?jobId=job-1");

  // Check if the combobox for job filtering displays "Job 1"
  const jobFilterButton = page.locator(
    'button[role="combobox"][name="filter-job"]'
  );

  // The button text should contain "Job 1"
  await expect(jobFilterButton).toHaveText(/Job 1/);
});
