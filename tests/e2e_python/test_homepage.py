
from playwright.sync_api import Page, expect

def test_homepage_loads_correctly(page: Page):
    page.goto("/")
    # Verify that the main content area loads by checking for specific text
    expect(page.get_by_text("Jobs & Sessions")).to_be_visible(timeout=10000)
