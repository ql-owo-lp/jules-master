
from playwright.sync_api import Page, expect

def test_should_display_pr_status_cache_refresh_interval_setting(page: Page):
    page.goto("/settings")

    # Switch to Configuration tab
    page.get_by_role("tab", name="Configuration").click()

    # Check if the setting input is visible
    label = page.get_by_text("PR Status Cache Refresh Interval (seconds)")
    expect(label).to_be_visible()

    # Check default value
    input_field = page.get_by_label("PR Status Cache Refresh Interval (seconds)")
    expect(input_field).to_have_value("60")

    # Update value
    input_field.fill("120")

    # Save changes
    page.get_by_role("button", name="Save Configuration").click()

    # Verify toast
    # Use exact match to differentiate from screen reader text which might contain more content
    expect(page.get_by_text("Settings Saved", exact=True)).to_be_visible()

    # Reload and verify persistence
    page.reload()

    # Switch to Configuration tab
    page.get_by_role("tab", name="Configuration").click()

    expect(page.get_by_label("PR Status Cache Refresh Interval (seconds)")).to_have_value("120")
