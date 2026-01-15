
from playwright.sync_api import Page, expect, sync_playwright
import json

def test_cron_badges(page: Page):
    # Log all requests
    page.on("console", lambda msg: print(f"Console: {msg.text}"))

    # Mock the API response
    def handle_route(route):
        print(f"Handling route: {route.request.url}")
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps([
            {
                "id": "1",
                "name": "Active Job",
                "schedule": "0 * * * *",
                "repo": "owner/repo1",
                "branch": "main",
                "lastRunAt": "2023-10-26T10:00:00Z",
                "enabled": True,
                "prompt": "test prompt",
                "createdAt": "2023-10-01T00:00:00Z",
                "autoApproval": True
            },
            {
                "id": "2",
                "name": "Paused Job",
                "schedule": "0 0 * * *",
                "repo": "owner/repo2",
                "branch": "develop",
                "lastRunAt": None,
                "enabled": False,
                "prompt": "test prompt 2",
                "createdAt": "2023-10-02T00:00:00Z",
                "autoApproval": False
            }
        ]))

    page.route("**/api/cron-jobs", handle_route)

    # Navigate to the settings page
    print("Navigating to settings...")
    page.goto("http://localhost:9002/settings")

    # Click on "Cron Jobs" tab
    print("Clicking Cron Jobs tab...")
    page.get_by_role("tab", name="Cron Jobs").click()

    # Wait for the table to appear (and badges)
    print("Waiting for 'Active Job'...")
    expect(page.get_by_text("Active Job")).to_be_visible(timeout=10000)

    # Check if badges are visible
    expect(page.get_by_text("Active", exact=True)).to_be_visible()
    expect(page.get_by_text("Paused", exact=True)).to_be_visible()

    # Take a screenshot
    print("Taking screenshot...")
    page.screenshot(path="verification/cron_badges.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_cron_badges(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
