
import re
from playwright.sync_api import Page, expect

def test_should_open_send_message_dialog_and_quick_reply_popover(page: Page):
    page.goto("/")

    # Ensure API key is set (if injection failed, set it via UI)
    alert = page.get_by_text("API Key Not Set")
    if alert.is_visible():
        page.get_by_role("button", name="Open settings").click()
        page.get_by_label("Jules API Key").fill("test-api-key")
        page.get_by_role("button", name="Save Changes").click()
        expect(alert).to_be_hidden()

    # The screenshot shows "Uncategorized Sessions" accordion is collapsed by default.
    # We need to expand it first.
    accordion_trigger = page.get_by_role("button", name=re.compile("Uncategorized Sessions"))

    # Wait for trigger to be visible (implies sessions loaded)
    expect(accordion_trigger).to_be_visible(timeout=10000)

    if accordion_trigger.get_attribute("aria-expanded") == "false":
        accordion_trigger.click()

    # Wait for mock sessions to load
    # "Mock Session 1" is defined in MOCK_SESSIONS in src/app/sessions/actions.ts
    expect(page.get_by_text("Mock Session 1", exact=False)).to_be_visible()

    # Find the row for Mock Session 1
    row = page.locator("tr", has_text="Mock Session 1")

    # --- Test Send Message Dialog ---

    # Find the Send Message button.
    # The button is inside the actions cell (last cell).
    # Mock Session 1 is COMPLETED, so no Approve button.
    # So Send Message should be the first button in the last cell.

    actions_cell = row.locator("td").last
    send_message_btn = actions_cell.locator("button").first

    # Click it
    send_message_btn.click()

    # Verify Dialog opens
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    expect(dialog.get_by_role("heading", name="Send Message to Session")).to_be_visible()

    # Close Dialog
    page.keyboard.press("Escape")
    expect(dialog).to_be_hidden()

    # --- Test Quick Reply Popover ---

    # It should be the second button
    quick_reply_btn = actions_cell.locator("button").nth(1)

    # Click it
    quick_reply_btn.click()

    # Verify Popover content appears
    # It contains a Command input with placeholder "Search replies..."
    expect(page.get_by_placeholder("Search replies...")).to_be_visible()

    # Verify we can type in it (checking focus/interactivity)
    page.get_by_placeholder("Search replies...").fill("Hello")
    expect(page.get_by_placeholder("Search replies...")).to_have_value("Hello")

    # Close popover (clicking outside)
    page.mouse.click(0, 0)
    expect(page.get_by_placeholder("Search replies...")).to_be_hidden()
