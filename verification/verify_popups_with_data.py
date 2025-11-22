import json
from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Inject data into localStorage before page load (or after)
        # Since localStorage is per origin, we need to go to the origin first.
        # But if server is not up, we can't.
        # Assuming server comes up.

        try:
            page.goto("http://localhost:3000")
        except Exception as e:
            print("Failed to load page, maybe server is starting up? Retrying...")
            page.wait_for_timeout(5000)
            page.goto("http://localhost:3000")

        # Define dummy data
        sessions = [
            {
                "id": "sess-1",
                "title": "Test Session 1",
                "state": "COMPLETED",
                "createTime": "2023-10-27T10:00:00Z",
                "url": "http://example.com",
                "outputs": []
            }
        ]
        jobs = [
            {
                "id": "job-1",
                "name": "Test Job 1",
                "repo": "owner/repo",
                "branch": "main",
                "sessionIds": ["sess-1"]
            }
        ]

        # Inject data
        page.evaluate(f"""() => {{
            localStorage.setItem('jules-sessions', '{json.dumps(sessions)}');
            localStorage.setItem('jules-jobs', '{json.dumps(jobs)}');
        }}""")

        # Reload to pick up data
        page.reload()
        page.wait_for_timeout(2000)

        # Expand the job accordion
        page.click("text=Test Job 1")
        page.wait_for_timeout(500)

        # 1. Test "Send Message" Dialog
        # Find the session row
        # Click the message button. It has aria-label "Send Message"? No, tooltop content is "Send Message"
        # The button has <MessageSquare /> icon.
        # Locator might be tricky.
        # Let's find the row.
        row = page.locator("tr", has_text="Test Session 1")

        # Inside row, find the message button.
        # It's a button with MessageSquare icon.
        # We can try selecting by position or icon class if needed, but better by role/tooltip?
        # Tooltip trigger doesn't expose accessible name easily until hovered.

        # Let's verify initial state
        page.screenshot(path="verification/1_list_expanded.png")

        # Click the button that corresponds to "Send Message"
        # In the row, there are: Checkbox, Link(Bot), PrStatus, Action buttons.
        # Action buttons: Approve (if pending), Message, Quick Reply.
        # This session is COMPLETED, so no Approve button.
        # So we have Message and Quick Reply.
        # Message is first.

        msg_btn = row.locator("button").nth(2) # 0 is checkbox? No, checkbox is in cell 1.
        # Cells: 1(Checkbox), 2(Title), 3(Status), 4(Created), 5(Jules Link), 6(Github), 7(Actions)
        # Actions cell has buttons.
        actions_cell = row.locator("td").last
        msg_btn = actions_cell.locator("button").first

        msg_btn.click()
        page.wait_for_timeout(500)
        page.screenshot(path="verification/2_message_dialog.png")

        # Check if dialog is visible
        if page.locator("div[role='dialog']").is_visible():
            print("Message Dialog opened!")
            page.keyboard.press("Escape")
        else:
            print("Message Dialog NOT opened!")

        page.wait_for_timeout(500)

        # 2. Test "Quick Reply" Popover
        # It's the second button in actions cell (or third if approve exists)
        reply_btn = actions_cell.locator("button").nth(1)
        reply_btn.click()
        page.wait_for_timeout(500)
        page.screenshot(path="verification/3_quick_reply_popover.png")

        # Check if popover content is visible.
        # It contains a Command input.
        if page.locator("input[placeholder='Search replies...']").is_visible():
            print("Quick Reply Popover opened and Input found!")
        else:
            print("Quick Reply Popover NOT opened or Input not found!")

        browser.close()

if __name__ == "__main__":
    run()
