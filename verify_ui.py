
from playwright.sync_api import sync_playwright

def verify_job_creation_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # Navigate to the job creation page
            # Assuming it's at /jobs/new or similar, or I can trigger the dialog
            # The URL structure suggests /jobs/new based on file structure
            page.goto("http://localhost:3000/jobs/new")

            # Wait for the form to load
            page.wait_for_selector("form", timeout=10000)

            # Take a screenshot of the form
            page.screenshot(path="verification_screenshot.png")
            print("Screenshot taken successfully.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_job_creation_page()
