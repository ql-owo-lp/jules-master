from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:9002/settings")
    page.wait_for_load_state("networkidle")
    page.screenshot(path="verification/debug_settings.png")
    print(page.title())
    browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
