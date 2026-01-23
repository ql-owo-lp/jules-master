
from playwright.sync_api import sync_playwright, expect

def verify_cron_validation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to Settings page where CronJobsList is located
        page.goto("http://localhost:3000/settings")

        # Wait for page to load
        page.wait_for_load_state("networkidle")

        # Take a screenshot to verify we are on settings page
        page.screenshot(path="verification/settings_page.png")

        # Find "Cron Jobs" tab or section
        # The settings page might have tabs.

        # Let's try to find "Add New Cron Job" or "Create" button for cron jobs.
        # In cron-jobs-list.tsx, it renders:
        # <CardTitle>Cron Jobs</CardTitle>
        # and <CronJobDialog mode="create" ... />

        # Look for "Cron Jobs" heading
        expect(page.get_by_text("Cron Jobs", exact=True)).to_be_visible()

        # Look for the trigger button for CronJobDialog.
        # In cron-job-dialog.tsx, for "create" mode, it usually renders a button.
        # Let's try to find a button near "Cron Jobs" title.

        # If no cron jobs, the empty state says: "Click "Add New Cron Job" to create your first scheduled job."
        # The button text might be "Add New Cron Job" or just an icon button if it's in the header.

        # Let's try to find the button by role and text.
        # If I look at cron-job-dialog.tsx code (I didn't read it but let's assume), it probably has a Trigger.

        # Let's try to click on a button that looks like "Add" or "New".
        # The empty state text suggests the button name.

        # Let's dump buttons if needed.

        # Try finding the "Add New Cron Job" button
        try:
             # Try searching for the button directly
             page.get_by_role("button", name="Add New Cron Job").click()
        except:
             try:
                 # Maybe it is "New Cron Job"
                 page.get_by_role("button", name="New Cron Job").click()
             except:
                 # Maybe it is just an icon in the card header.
                 # Let's look for a button inside the CardHeader.
                 pass

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
