
from playwright.sync_api import sync_playwright

def verify_auto_approval_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # 1. Check Job Creation Form
            print("Navigating to Job Create Page...")
            page.goto("http://localhost:9002/jobs/new")

            # Wait for form
            page.wait_for_selector("text=New Job")

            # Check for "Require Plan Approval" switch
            require_approval_switch = page.get_by_label("Require Plan Approval")
            if require_approval_switch.is_visible():
                print("Require Plan Approval switch is visible.")
            else:
                print("ERROR: Require Plan Approval switch not found.")

            page.screenshot(path="verification/job_creation.png")

            # 2. Check Settings Page
            print("Opening Settings...")
            # Reload page to reset state if needed, or just go to home
            page.goto("http://localhost:9002/")

            # Click settings button
            page.get_by_label("Open settings").click()

            # Wait for settings sheet
            page.wait_for_selector("text=Settings")

            # Scroll down to find Auto Approval Interval
            # It might be at the bottom
            page.mouse.wheel(0, 1000)

            auto_approval_input = page.get_by_label("Auto Approval Check Interval (seconds)")
            if auto_approval_input.is_visible():
                print("Auto Approval Interval input is visible.")
            else:
                print("ERROR: Auto Approval Interval input not found.")
                # Print page content for debugging
                # print(page.content())

            page.screenshot(path="verification/settings.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_auto_approval_ui()
