
from playwright.sync_api import sync_playwright, expect

def verify_cron_validation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to Settings page
        page.goto("http://localhost:3000/settings")

        # Wait for page to load
        page.wait_for_load_state("networkidle")

        # Click on "Cron Jobs" tab
        # Based on screenshot, there are tabs: General, Cron Jobs, Messages, Automation, Cache, Display, Profiles
        page.get_by_role("tab", name="Cron Jobs").click()

        # Wait for Cron Jobs panel
        expect(page.get_by_text("Cron Jobs", exact=True)).to_be_visible()

        # Click "Add New Cron Job"
        # Since I suspect it might be an icon button or named differently, I'll try finding it by role button within the panel.
        # But based on cron-jobs-list.tsx, it's inside CardHeader.
        # <CronJobDialog mode="create" ... />

        # Let's try to find the button by common add icons or text.
        # Or look for text "Add New Cron Job" if the list is empty.

        # If I look at cron-job-dialog.tsx, the trigger usually wraps a child.
        # If it's `<CronJobDialog mode="create" />` without children, does it have a default trigger?
        # I need to check cron-job-dialog.tsx to be sure.
        # But typically it renders a button.

        # Let's try to click the button that opens the dialog.
        # I'll search for a button with text "New Cron Job" or "Add".

        # If the list is empty, there is a text:
        # "Click "Add New Cron Job" to create your first scheduled job."
        # This implies the button has that name or title.

        # Try finding button by label or text
        try:
            page.get_by_label("Add New Cron Job").click()
        except:
             try:
                 page.get_by_role("button", name="Add New Cron Job").click()
             except:
                 # Maybe it's just "New Cron Job"
                 page.get_by_role("button", name="New Cron Job").click()

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
