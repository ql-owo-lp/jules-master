
from playwright.sync_api import sync_playwright

def verify_settings():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to settings page
            page.goto("http://localhost:9002/settings?tab=automation")

            # Wait for settings to load
            page.wait_for_selector("text=Check Failing Actions")

            # Take screenshot of automation tab
            page.screenshot(path="verification_settings.png", full_page=True)
            print("Screenshot taken: verification_settings.png")

        except Exception as e:
            print(f"Verification failed: {e}")
            # Take error screenshot
            page.screenshot(path="verification_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_settings()
