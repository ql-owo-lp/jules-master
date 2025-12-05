
import re
from playwright.sync_api import Page, expect

def test_should_verify_settings_page_layout_and_tabs(page: Page):
    # Navigate to the home page first
    page.goto("/")

    # Wait for the sidebar to load and click Settings
    # The sidebar link for Settings should have "Settings" text
    page.get_by_role("link", name="Settings").click()

    # Wait for navigation to /settings
    expect(page).to_have_url(re.compile(r"/settings"))

    # Verify Tabs are present
    expect(page.get_by_role("tab", name="General")).to_be_visible()
    expect(page.get_by_role("tab", name="Messages")).to_be_visible()
    expect(page.get_by_role("tab", name="Automation")).to_be_visible()
    expect(page.get_by_role("tab", name="Display")).to_be_visible()
    expect(page.get_by_role("tab", name="Configuration")).to_be_visible()

    # Verify General Tab content (default)
    expect(page.get_by_label("Jules API Key")).to_be_visible()

def test_should_switch_tabs_and_show_content(page: Page):
    page.goto("/settings")

    # Switch to Messages tab
    page.get_by_role("tab", name="Messages").click()

    # Wait for Global Prompt to appear
    # Using locator with exact text match to avoid matching button text
    expect(page.locator(':text-is("Global Prompt")')).to_be_visible()
    expect(page.locator(':text-is("Per-Repository Prompt")')).to_be_visible()

    # Switch to Automation tab
    page.get_by_role("tab", name="Automation").click()
    expect(page.get_by_label("Auto Retry Failed Sessions")).to_be_visible()

     # Switch to Display tab
    page.get_by_role("tab", name="Display").click()
    expect(page.get_by_label("Jobs Per Page")).to_be_visible()

     # Switch to Configuration tab
    page.get_by_role("tab", name="Configuration").click()
    expect(page.get_by_label("Idle Poll Interval (seconds)")).to_be_visible()
