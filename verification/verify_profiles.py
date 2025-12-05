
from playwright.sync_api import sync_playwright, expect

def verify_profiles(page):
    # Navigate to Settings
    page.goto("http://localhost:9002/settings")
    page.wait_for_load_state("networkidle")

    # Verify we are on Settings page
    expect(page.get_by_role("heading", name="Settings")).to_be_visible()

    # Click on Profiles tab
    page.get_by_role("tab", name="Profiles").click()
    page.wait_for_timeout(500)

    # Verify Default profile exists
    expect(page.get_by_role("cell", name="Default")).to_be_visible()

    # Create a new profile
    page.get_by_placeholder("New profile name").fill("Test Profile A")
    page.get_by_role("button", name="Create Profile").click()

    # Verify new profile created
    expect(page.get_by_role("cell", name="Test Profile A")).to_be_visible()

    # Switch to new profile
    # Find the row with 'Test Profile A' and click 'Select' button within it
    # Playwright's locator strategy:
    row = page.get_by_role("row", name="Test Profile A")
    row.get_by_role("button", name="Select").click()

    page.wait_for_timeout(500)

    # Verify "Test Profile A" is selected (indicated by checkmark or UI state)
    # The UI shows "Current Profile: Test Profile A" at the top
    expect(page.get_by_text("Current Profile: Test Profile A")).to_be_visible()

    # Take screenshot of profiles tab
    page.screenshot(path="verification/profiles_tab.png")

    # Go to General tab and change a setting
    page.get_by_role("tab", name="General").click()

    # Set API Key for this profile
    page.get_by_label("Jules API Key").fill("key-for-profile-a")
    page.get_by_role("button", name="Save General Settings").click()
    page.wait_for_timeout(500) # wait for toast/save

    # Switch back to Default profile
    page.get_by_role("tab", name="Profiles").click()
    default_row = page.get_by_role("row", name="Default")
    default_row.get_by_role("button", name="Select").click()
    page.wait_for_timeout(500)

    expect(page.get_by_text("Current Profile: Default")).to_be_visible()

    # Go to General tab and verify API Key is empty (or different)
    page.get_by_role("tab", name="General").click()
    expect(page.get_by_label("Jules API Key")).to_have_value("")

    # Take screenshot of general tab for Default profile
    page.screenshot(path="verification/general_tab_default.png")

    print("Verification successful")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_profiles(page)
        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
