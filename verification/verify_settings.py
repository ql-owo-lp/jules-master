
from playwright.sync_api import sync_playwright

def verify_settings(page):
    # Go to settings page
    page.goto("http://localhost:9002/settings")

    # Wait for the page to load
    page.wait_for_selector("h1:has-text('Settings')")

    # Switch to Configuration tab
    page.click("button[role='tab']:has-text('Configuration')")

    # Check for new inputs
    page.wait_for_selector("label:has-text('Cache Update: In Progress')")
    page.wait_for_selector("label:has-text('Cache Update: Completed No PR')")

    # Take screenshot
    page.screenshot(path="verification/settings_config.png")
    print("Screenshot saved to verification/settings_config.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_settings(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
