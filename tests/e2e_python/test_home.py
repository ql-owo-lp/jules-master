
import re
from playwright.sync_api import Page, expect

def test_should_display_mocked_sessions(page: Page):
    # Mock API key so the app tries to fetch sessions
    page.add_init_script("""
        window.localStorage.setItem('jules-api-key', '"test-api-key"');
    """)

    page.goto("/")

    # Expand Uncategorized Sessions accordion
    accordion_trigger = page.get_by_role("button", name=re.compile("Uncategorized Sessions"))

    # Wait for trigger to be visible (implies sessions loaded)
    expect(accordion_trigger).to_be_visible(timeout=10000)

    if accordion_trigger.get_attribute("aria-expanded") == "false":
        accordion_trigger.click()

    # Check for mock session titles
    expect(page.get_by_text("Mock Session 1", exact=False)).to_be_visible()
    expect(page.get_by_text("Mock Session 2", exact=False)).to_be_visible()

    # Check for status badges (UI labels)
    expect(page.get_by_text("Completed", exact=True)).to_be_visible()
    expect(page.get_by_text("Awaiting User Feedback", exact=True)).to_be_visible()

def test_should_allow_setting_api_key(page: Page):
    # Clear API key for this test
    page.add_init_script("""
       window.localStorage.removeItem('jules-api-key');
    """)
    # We need to go to settings page to set API key now
    page.goto("/settings")

    # Fill API Key
    api_key_input = page.get_by_label("Jules API Key")
    api_key_input.fill("new-test-api-key")

    # Save
    page.get_by_role("button", name="Save General Settings").click()

    # Go back to home
    page.goto("/")

    # Verify alert is gone
    expect(page.get_by_text("API Key Not Set")).to_be_hidden()

def test_should_filter_sessions(page: Page):
    page.add_init_script("""
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
    """)
    page.goto("/")

    # Check if filter inputs are present
    expect(page.get_by_text("Repository", exact=True)).to_be_visible() # Label
    expect(page.get_by_text("Session Status", exact=True)).to_be_visible() # Label
    expect(page.get_by_text("Job Name", exact=True)).to_be_visible() # Label
