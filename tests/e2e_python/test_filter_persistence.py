
import re
from playwright.sync_api import Page, expect

def test_should_persist_repository_and_status_filters_in_the_url(page: Page):
    page.goto("/")

    # Select a repository filter
    # Node test: page.click('button[name="filter-repo"]');
    # Assuming these buttons exist.
    page.locator('button[name="filter-repo"]').click()
    page.locator('div[role="option"]').filter(has_text="All Repositories").click()

    # Select a status filter
    page.locator('button[name="filter-status"]').click()
    page.locator('div[role="option"]').filter(has_text="All Statuses").click()

    # Verify that the filters are in the URL
    expect(page).to_have_url(re.compile(r"repo=all"))
    expect(page).to_have_url(re.compile(r"status=all"))
