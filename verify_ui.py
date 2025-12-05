
from playwright.sync_api import sync_playwright

def verify_settings_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            print("Navigating to settings...")
            # Navigate to the settings page
            page.goto("http://localhost:9002/settings", timeout=60000)

            print("Waiting for Profiles tab...")
            # Wait for the profiles tab to be visible
            page.wait_for_selector("text=Profiles", timeout=60000)

            # Take a screenshot of the initial state (Profiles tab)
            page.screenshot(path="verify_screenshots/settings_profiles.png")
            print("Screenshot of Profiles tab saved.")

            # Click on General tab to verify merged configuration
            print("Clicking General tab...")
            page.click("text=General")
            page.wait_for_selector("text=General Settings")
            page.wait_for_selector("text=Advanced Polling & Limits") # Verify merged config section

            # Take a screenshot of the General tab
            page.screenshot(path="verify_screenshots/settings_general.png")
            print("Screenshot of General tab saved.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verify_screenshots/error.png")
            print("Error screenshot saved.")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_settings_page()
