
from playwright.sync_api import sync_playwright

def verify_profiles(page):
    # Go to settings page
    page.goto("http://localhost:9002/settings?tab=profiles")

    # Wait for loading to finish
    page.wait_for_selector("text=Profiles")

    # Click Add Profile
    page.click("text=Add Profile")

    # Fill in name
    page.fill("input#name", "Test Profile 2")

    # Click Save
    page.click("text=Save")

    # Wait for the new profile to appear
    page.wait_for_selector("text=Test Profile 2")

    # Take another screenshot
    page.screenshot(path="verification_after_add_v2.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_profiles(page)
        finally:
            browser.close()
