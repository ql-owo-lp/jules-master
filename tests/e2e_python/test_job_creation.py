
import re
from playwright.sync_api import Page, expect

def test_should_open_new_job_dialog_and_fill_form_with_mock_data(page: Page):
    # Mock API key to ensure form is enabled
    page.add_init_script("""
      window.localStorage.setItem('jules-api-key', '"test-api-key"');
    """)

    page.goto("/")

    page.get_by_role("button", name="Create New Job").click()

    expect(page.get_by_role("heading", name="Create a New Job")).to_be_visible()

    # Fill fields
    page.get_by_label("Job Name (Optional)").fill("Test Job")
    page.get_by_role("textbox", name="Session Prompts").fill("Test Prompt")
    page.get_by_label("Number of sessions").fill("1")

    # Select Repository from Mock Data
    # Wait for skeleton to disappear
    expect(page.locator("#repository-skeleton")).to_be_hidden(timeout=10000)

    # Check if error appeared
    error = page.locator("#repository-error")
    if error.is_visible():
        print(f"Repository Error: {error.inner_text()}")
    expect(error).to_be_hidden()

    # The mock data has "github/test-owner/test-repo"
    # We expect the repo to be auto-selected
    repo_combobox = page.get_by_role("combobox").filter(has_text=re.compile("test-owner/test-repo")).first
    expect(repo_combobox).to_be_enabled()
    expect(repo_combobox).to_have_text(re.compile("test-owner/test-repo"))

    # Select Branch
    # Branch combobox should also be visible. It usually defaults to 'main'.
    branch_combobox = page.get_by_role("combobox").filter(has_text=re.compile("main")).first
    expect(branch_combobox).to_be_visible()

    # Wait for it to be enabled (implies source is selected)
    expect(branch_combobox).to_be_enabled()

    # Verify 'main' is selected (default branch)
    expect(branch_combobox).to_have_text(re.compile("main"))

    branch_combobox.click()
    expect(page.get_by_role("option", name="main")).to_be_visible()
    expect(page.get_by_role("option", name="develop")).to_be_visible()
    page.get_by_role("option", name="develop").click() # Switch to develop

    # Check submit button
    create_button = page.get_by_role("button", name="Create Job")
    expect(create_button).to_be_visible()
    expect(create_button).to_be_enabled()
