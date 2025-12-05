
import pytest
import os
import sqlite3
import json
import time
from datetime import datetime, timezone
from playwright.sync_api import Page, expect

DB_PATH = os.path.join(os.getcwd(), 'data', 'sqlite.db')

@pytest.fixture(scope="module")
def setup_background_job():
    job_id = 'e2e-progress-job'

    # Ensure DB exists
    if not os.path.exists(DB_PATH):
        pytest.fail('Database not found. Please run the app first.')

    # Direct DB manipulation to setup test state
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Clean up
    try:
        cursor.execute('DELETE FROM jobs WHERE id = ?', (job_id,))
    except sqlite3.OperationalError:
        # Table might not exist if migration failed or wasn't run?
        # But we ran migration.
        pass

    created_at = datetime.now(timezone.utc).isoformat()

    cursor.execute('''
      INSERT INTO jobs (id, name, session_ids, created_at, repo, branch, status, session_count, prompt, background)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
      job_id,
      'E2E Progress Job',
      json.dumps(['s1', 's2']),
      created_at,
      'owner/repo',
      'main',
      'PROCESSING',
      10,
      'Prompt',
      1 # true
    ))

    conn.commit()
    conn.close()

    yield job_id

    # Teardown
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM jobs WHERE id = ?', (job_id,))
    conn.commit()
    conn.close()

def test_should_display_progress_bar_for_processing_jobs(page: Page, setup_background_job):
    # 1. Navigate to homepage
    page.goto("/")

    # Mock API Key
    page.add_init_script("""
        window.localStorage.setItem('jules-api-key', '"test-api-key"');
    """)

    # Clear local storage to force refresh from DB (except api key, but the test clears everything)
    page.evaluate("localStorage.clear()")
    page.add_init_script("""
        window.localStorage.setItem('jules-api-key', '"test-api-key"');
    """)
    page.reload()

    # Wait for the page to settle and hydration
    page.wait_for_timeout(1000)

    # Click refresh button to be sure
    refresh_btn = page.get_by_role("button", name="Refresh job list")
    if refresh_btn.is_visible():
        refresh_btn.click()
        page.wait_for_timeout(1000)

    # 2. Find the job accordion item
    job_header = page.get_by_text("E2E Progress Job")
    expect(job_header).to_be_visible()

    # Expand if needed (it might be collapsed)
    job_header.click()

    # 3. Verify Progress Bar
    # Look for text "Creating Sessions..."
    expect(page.get_by_text("Creating Sessions...")).to_be_visible()

    # Look for count "2 / 10"
    expect(page.get_by_text("2 / 10")).to_be_visible()

    # Verify progress bar element exists (role 'progressbar')
    # Use css selector for the container
    progress_section = page.locator(".px-4.py-3.bg-muted\\/20")
    expect(progress_section).to_be_visible()
    expect(progress_section.get_by_role("progressbar")).to_be_visible()
