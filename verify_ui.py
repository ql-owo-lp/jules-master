
from playwright.sync_api import Page, expect, sync_playwright

def verify_settings_page(page: Page):
  """
  This test verifies that the new auto-delete settings are visible on the
  settings page.
  """
  # 1. Arrange: Go to the settings page.
  page.goto("http://localhost:9002/settings")

  # 2. Act: Find the "Automation" tab and click it.
  automation_tab = page.get_by_role("tab", name="Automation")
  automation_tab.click()

  # 3. Assert: Confirm the new settings are visible.
  expect(page.get_by_label("Auto Delete Stale Branches")).to_be_visible()

  # 4. Screenshot: Capture the final result for visual verification.
  page.screenshot(path="/app/verification_screenshot.png")

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      verify_settings_page(page)
    finally:
      browser.close()
