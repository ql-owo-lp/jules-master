
import re
from playwright.sync_api import Page, expect

def test_should_allow_creating_a_job_when_jules_api_key_is_present_in_env(page: Page):
    # Navigate to the home page
    page.goto("/")

    page.get_by_role("button", name="New Job").first.click()

    expect(page.get_by_role("heading", name="Create a New Job")).to_be_visible()

    create_button = page.get_by_role("button", name="Create Job")

    # Fill fields to enable the button (if api key is present)
    page.get_by_label("Job Name (Optional)").fill("Integration Test Job")
    page.get_by_role("textbox", name="Session Prompts").fill("Integration Test Prompt")
    page.get_by_label("Number of sessions").fill("1")

    # Wait for skeleton to disappear and repo to be loaded
    expect(page.locator("#repository-skeleton")).to_be_hidden(timeout=10000)

    # Select Repository (Mock Data or Real Data depending on backend)
    # Since MOCK_API=true in playwright config, we expect mock data.
    repo_combobox = page.get_by_role("combobox").filter(has_text=re.compile("test-owner/test-repo")).first
    expect(repo_combobox).to_be_visible()

    # Select Branch
    branch_combobox = page.get_by_role("combobox").filter(has_text=re.compile("main")).first
    branch_combobox.click()
    page.get_by_role("option", name="main").click()

    # Now check if Create Button is enabled.
    # It should be enabled if API key is present.
    expect(create_button).to_be_enabled(timeout=5000)

    create_button.click()

    # Verify job submitted toast or redirection
    # The message might be "Background Job Scheduled" if background job is selected (default)
    # or "Job submitted!" if not.
    toast_message = page.get_by_text(re.compile(r"Job submitted!|Background Job Scheduled")).first
    expect(toast_message).to_be_visible()
