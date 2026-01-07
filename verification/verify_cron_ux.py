from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Navigate to Settings page
    page.goto("http://localhost:9002/settings")

    # Wait for page to be ready
    page.wait_for_load_state("networkidle")

    # Click "Cron Jobs" tab
    page.get_by_role("tab", name="Cron Jobs").click()

    # Wait for the Cron Jobs list to appear
    # There should be an "Add New Cron Job" button
    # Using specific locator to avoid ambiguity
    page.get_by_role("button", name="Add New Cron Job").click()

    # Now the dialog should be open.
    # Find the schedule input.
    schedule_input = page.get_by_label("Schedule (Cron Expression)")

    # Type a valid cron expression
    schedule_input.fill("0 0 * * 1") # Weekly on Monday

    # Wait for the next run text to appear
    # The text starts with "Next run:"
    next_run_text = page.locator("text=Next run:")
    expect(next_run_text).to_be_visible()

    # Take a screenshot
    page.screenshot(path="verification/cron_ux_verification.png")

    browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
