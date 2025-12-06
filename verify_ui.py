
from playwright.sync_api import sync_playwright

def verify_profiles_tab():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # Navigate to Settings page
            page.goto("http://localhost:9002/settings")

            # Click on Profiles tab
            page.get_by_role("tab", name="Profiles").click()

            # Wait for content to load
            page.wait_for_selector("text=Profiles")
            page.wait_for_selector("text=Create Profile")

            # Take screenshot of Profiles tab
            page.screenshot(path="verification/profiles_tab.png")
            print("Screenshot taken: verification/profiles_tab.png")

            # Click Create Profile button to show dialog
            page.get_by_role("button", name="Create Profile").click()
            page.wait_for_selector("text=Create Profile")

            # Take screenshot of Create Profile dialog
            page.screenshot(path="verification/create_profile_dialog.png")
            print("Screenshot taken: verification/create_profile_dialog.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_profiles_tab()
