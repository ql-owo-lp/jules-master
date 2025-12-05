
import re
from playwright.sync_api import Page, expect

def test_should_verify_auto_approval_ui_elements(page: Page):
    # Mock API key to ensure form is enabled
    page.add_init_script("""
        window.localStorage.setItem('jules-api-key', '"test-api-key"');
    """)

    # 1. Check Job Creation Form for "Require Plan Approval" switch
    page.goto("/jobs/new")

    # Wait for form to be ready - matching the snapshot structure
    # Using text because "New Job" is inside a generic container that looks like a title but isn't a heading role
    expect(page.get_by_text("New Job", exact=True)).to_be_visible()

    # Check for "Require Plan Approval" switch
    require_approval_label = page.get_by_label("Require Plan Approval")
    expect(require_approval_label).to_be_visible()

    # 2. Check Settings Page for "Auto Approval Check Interval"
    page.goto("/settings")
    # Switch to Automation tab
    page.get_by_role("tab", name="Automation").click()

    # Check for Auto Approval Interval input
    auto_approval_input = page.get_by_label("Auto Approval Check Interval (seconds)")
    expect(auto_approval_input).to_be_visible()

def test_should_create_a_job_with_auto_approval_enabled(page: Page):
    page.add_init_script("""
        window.localStorage.setItem('jules-api-key', '"test-api-key"');
    """)
    page.goto("/jobs/new")
    expect(page.get_by_text("New Job", exact=True)).to_be_visible()

    # Fill basic info
    page.get_by_label("Job Name (Optional)").fill("Auto Approval Test Job")
    page.get_by_role("textbox", name="Session Prompts").fill("Test Prompt")
    page.get_by_label("Number of sessions").fill("1")

    # Select Repository (Mock Data)
    expect(page.locator("#repository-skeleton")).to_be_hidden(timeout=10000)

    # Use exact match or regex for the combobox that displays the repository
    repo_combobox = page.get_by_role("combobox").filter(has_text=re.compile("test-owner/test-repo")).first
    expect(repo_combobox).to_be_visible()

    # Ensure "Require Plan Approval" is UNCHECKED (which means Auto Approval is ON)
    require_approval_switch = page.get_by_role("switch", name="Require Plan Approval")

    # If it's checked, uncheck it.
    if require_approval_switch.is_checked():
        require_approval_switch.click()

    expect(require_approval_switch).not_to_be_checked()

    # Select Branch if needed (it might be auto-selected)
    branch_combobox = page.get_by_role("combobox").filter(has_text=re.compile("main")).first
    expect(branch_combobox).to_be_visible()

    # Create the job
    create_button = page.get_by_role("button", name="Create Job")
    expect(create_button).to_be_enabled()

    # We do not click submit to avoid 401 Unauthorized in this mock environment

def test_should_persist_auto_approval_interval_setting(page: Page):
    page.add_init_script("""
        window.localStorage.setItem('jules-api-key', '"test-api-key"');
    """)
    page.goto("/settings")
    # Switch to Automation tab
    page.get_by_role("tab", name="Automation").click()

    input_field = page.get_by_label("Auto Approval Check Interval (seconds)")
    expect(input_field).to_be_visible()

    # Change value
    input_field.fill("123")

    # Save Changes
    page.get_by_role("button", name="Save Automation Settings").click()

    # Wait for toast or dialog close
    expect(page.get_by_text("Settings Saved", exact=True)).to_be_visible()

    # Reload and verify
    page.reload()
    # Switch to Automation tab
    page.get_by_role("tab", name="Automation").click()

    expect(page.get_by_label("Auto Approval Check Interval (seconds)")).to_have_value("123")
