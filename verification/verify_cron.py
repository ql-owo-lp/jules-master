
from playwright.sync_api import sync_playwright, expect

def verify_cron_validation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the home page (which has the cron jobs list and "Add New Cron Job" button)
        page.goto("http://localhost:3000")

        # Click "Add New Cron Job" to open the dialog
        # Note: The "Add New Cron Job" button in CronJobsList (cron-jobs-list.tsx) triggers the dialog.
        # But wait, CronJobsList is inside the main page.
        # Let's find the button.

        # Wait for page to load
        page.wait_for_load_state("networkidle")

        # Click the "Add New Cron Job" button.
        # In cron-jobs-list.tsx, CronJobDialog is used.
        # The trigger button is inside CronJobDialog component.
        # Let's look for text "Add New Cron Job" or "Create Cron Job"
        # Reading cron-job-dialog.tsx might be needed, but usually it renders a button.
        # Or look for button with plus icon.

        # Actually, let's just look for "Add New Cron Job" or similar.
        # In cron-jobs-list.tsx:
        # <CronJobDialog mode="create" onSuccess={fetchCronJobs} />

        # In cron-job-dialog.tsx (I haven't read it but I can guess).
        # Let's try to find a button "New Cron Job" or check the page content first.

        # If no cron jobs, there is a text "Click "Add New Cron Job" to create your first scheduled job."
        # The button itself might just be the trigger.

        # Let's take a screenshot of the main page first to debug if needed.
        page.screenshot(path="verification/home.png")

        # Try to find the button.
        # Assuming it's a button with text "New Cron Job" or similar.
        # If I can't find it, I will check the screenshot.

        # Let's try "New Cron Job"
        try:
             page.get_by_role("button", name="New Cron Job").click()
        except:
             # Maybe it's just an icon or "Add".
             # Let's dump the text content
             print(page.content())
             return

        # Wait for dialog
        expect(page.get_by_role("dialog")).to_be_visible()

        # Find the Schedule input
        schedule_input = page.get_by_label("Schedule (Cron Expression)")

        # Type invalid cron
        schedule_input.fill("invalid cron")

        # Expect error message
        expect(page.get_by_text("Invalid cron expression")).to_be_visible()

        # Take screenshot of the error state
        page.screenshot(path="verification/cron_validation_error.png")

        # Type valid cron
        schedule_input.fill("0 0 * * *")

        # Expect error message to be gone and Next run to be visible
        expect(page.get_by_text("Invalid cron expression")).not_to_be_visible()
        expect(page.get_by_text("Next run:")).to_be_visible()

        # Take screenshot of the valid state
        page.screenshot(path="verification/cron_validation_valid.png")

if __name__ == "__main__":
    verify_cron_validation()
