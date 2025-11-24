
from playwright.sync_api import sync_playwright

def verify_settings(page):
    # Navigate to the settings page (assuming it's at /settings or accessible via UI)
    # Since I'm not sure of the exact URL structure, I'll try to find the settings button on home page first
    # or go directly to /settings if it exists.
    # The page.tsx at root has settings in top right corner probably.
    # But let's try direct navigation to /settings as that's where I added the page.

    # Wait for server to be ready
    try:
        page.goto("http://localhost:9002/settings")
    except Exception as e:
        print(f"Failed to load page: {e}")
        return

    # Check for the new "Cache" tab
    # The tabs are implemented using Radix UI Tabs

    # Wait for the tabs to appear
    page.wait_for_selector('button[role="tab"]')

    # Click on the "Cache" tab
    cache_tab = page.get_by_role("tab", name="Cache")
    if cache_tab.is_visible():
        cache_tab.click()
        print("Clicked Cache tab")
    else:
        print("Cache tab not found")
        return

    # Verify the new inputs are present
    # Labels: "In Progress Update Interval", "Pending Approval Update Interval", "Completed (No PR) Update Interval", "Max Session Age to Update"

    page.wait_for_selector('label:has-text("In Progress Update Interval")')

    # Take a screenshot
    page.screenshot(path="verification_screenshot.png")
    print("Screenshot taken")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_settings(page)
        finally:
            browser.close()
