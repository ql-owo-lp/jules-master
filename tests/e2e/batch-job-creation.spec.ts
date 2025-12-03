import { test, expect } from "@playwright/test";

test("Batch Job Creation", async ({ page }) => {
  test.setTimeout(120000); // Increase timeout to 120 seconds
  // Set API key in local storage
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("jules-api-key", '"test-api-key"');
  });

  await page.goto("/jobs/new");

  // Fill in the job details
  await page.fill("#job-name", "My Batch Job");
  await page.fill("#session-count", "1");
  await page.fill(
    "#prompts",
    "Create a boba app!\nCreate a pizza app!\nCreate a soda app!"
  );

  // Click the create button
  await page.click("button[type='submit']");

  // Wait for the navigation to the home page to complete
  await page.waitForURL("/");

  // Verify that the jobs are created
  await expect(page.locator("text=My Batch Job (1)")).toBeVisible();
  await expect(page.locator("text=My Batch Job (2)")).toBeVisible();
  await expect(page.locator("text=My Batch Job (3)")).toBeVisible();
});
