
from playwright.sync_api import sync_playwright

def verify_settings(page):
    page.goto("http://localhost:9002/settings")
    page.wait_for_selector("text=Save General Settings")
    page.screenshot(path="verification.png")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    try:
        verify_settings(page)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()
