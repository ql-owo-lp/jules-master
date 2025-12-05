
import re
from playwright.sync_api import Page, expect

def test_should_verify_sidebar_links_and_buttons(page: Page):
    page.goto("/")

    # Verify Home link (Logo) - use first() as it appears in Sidebar and Header
    expect(page.get_by_role("link", name="Jules Master").first).to_be_visible()

    # Verify "New Job" button
    expect(page.get_by_role("button", name="New Job")).to_be_visible()
    expect(page.get_by_role("button", name="New Job")).to_be_enabled()

    # Verify "Jobs & Sessions" link
    job_list_link = page.get_by_role("link", name="Jobs & Sessions")
    expect(job_list_link).to_be_visible()
    # Click and verify navigation
    job_list_link.click()

    # Wait for URL
    expect(page).to_have_url(re.compile(r"/$"))
    # Use locator for CardTitle (div with specific class or just text outside of link)
    expect(page.locator(".text-2xl", has_text="Jobs & Sessions")).to_be_visible()

    # Verify "Settings" link
    # Re-query the element
    settings_link = page.get_by_role("link", name="Settings")
    expect(settings_link).to_be_visible()
    # Click and verify navigation
    settings_link.click()
    expect(page).to_have_url(re.compile(r"/settings"))
    # Use heading role to be specific
    expect(page.get_by_role("heading", name="Settings", level=1)).to_be_visible()
