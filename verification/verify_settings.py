
from playwright.sync_api import sync_playwright
import time

def verify_settings():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # Go to the home page (port 9002 based on log)
            page.goto("http://localhost:9002")

            # Wait for page to load
            time.sleep(5)

            # Click the settings button (it has aria-label="Open settings")
            # The button is likely an icon button.
            page.get_by_label("Open settings").click()

            # Wait for sheet to open
            time.sleep(2)

            # Scroll down to find the new settings
            # We need to find the element and scroll it into view if needed, but screenshot might capture visible area.

            # Check if the new settings are visible
            if page.get_by_text("Auto Retry Failed Sessions").is_visible():
                print("Auto Retry setting found!")
            else:
                print("Auto Retry setting NOT found!")

            if page.get_by_text("Auto Continue Completed Sessions").is_visible():
                print("Auto Continue setting found!")
            else:
                print("Auto Continue setting NOT found!")

            # Take a screenshot of the settings sheet
            page.screenshot(path="verification/settings_sheet.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_settings()
