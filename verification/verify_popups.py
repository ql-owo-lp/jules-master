from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to home
        page.goto("http://localhost:3000")

        # Wait for sessions to load (assuming some initial state or just wait for load)
        page.wait_for_timeout(3000) # Give it some time to fetch/hydrate

        # Take a screenshot of the list
        page.screenshot(path="verification/list_initial.png")
        print("Initial screenshot taken")

        # Since there might be no data, we can't easily click a button in the row
        # However, if there are no sessions, there's a "No jobs found" message.
        # If I can't mock data, I can't verify the button clicks easily.

        # Let's check if there are buttons.
        buttons = page.locator("button")
        count = buttons.count()
        print(f"Found {count} buttons")

        # If we have "Jobs & Sessions", maybe we have some structure.
        # But data is in local storage. I can inject local storage data!

        browser.close()

if __name__ == "__main__":
    run()
