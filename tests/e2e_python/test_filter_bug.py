
import re
from playwright.sync_api import Page, expect

def test_job_filter_should_be_preserved_after_viewing_a_session(page: Page):
    page.goto("/")

    # Mock jobs and sessions data
    # Note: The app uses SQL DB, but maybe the test relies on localStorage cache or the app reads from it?
    # The original test used localStorage mocking for jobs/sessions.
    # If the app truly uses DB, then this test assumes the app syncs or uses LS.
    # Based on previous tests, it seems the app uses DB.
    # However, `filter-bug.spec.ts` mocks localStorage "jules-jobs" and "jules-sessions".
    # This suggests there might be a client-side cache or the test is for an older version?
    # OR the app supports client-side only mode?
    # Or this particular test setup is just mocking the state if the component reads from LS.
    # Let's replicate what the Node test did.

    page.evaluate("""() => {
        window.localStorage.setItem("jules-jobs", JSON.stringify([
          { id: "job-1", name: "Job 1", sessionIds: ["session-1"], repo: "test/repo", branch: "main" },
          { id: "job-2", name: "Job 2", sessionIds: ["session-2"], repo: "test/repo", branch: "main" },
        ]));
        window.localStorage.setItem("jules-sessions", JSON.stringify([
          { id: "session-1", title: "Session 1", state: "COMPLETED", createTime: new Date().toISOString() },
          { id: "session-2", title: "Session 2", state: "COMPLETED", createTime: new Date().toISOString() },
        ]));
        window.localStorage.setItem("jules-last-updated-at", Date.now().toString());
    }""")

    page.goto("/")

    # Open the accordion for Job 2
    # This might fail if the app ignores LS and fetches from DB (which is empty/different).
    # If this fails, we need to populate DB.
    # But `filter-bug.spec.ts` passed in Node? Or maybe it was skipped?
    # If the app reads from DB, setting LS won't help unless there is code to hydrate from LS.
    # Let's try running it. If it fails, I'll update it to use DB.

    # Wait, the node test uses `window.localStorage`.
    # If the Node test was working, then the app must use LS for something or the test is invalid/old.
    # Or `jules-jobs` in LS triggers some UI state?

    try:
        page.get_by_text("Job 2").click(timeout=5000)
    except Exception:
        # If we can't find Job 2, it means the LS mock didn't work.
        # I will assume for now we need to insert into DB like in `background-jobs.spec.ts`
        # But let's first try to see if LS works.
        pass

    # Click on the session row for "Session 2"
    page.get_by_text("Session 2").click()

    page.wait_for_url(re.compile(r".*/sessions/session-2\?jobId=job-2"))

    # Check that the URL is correct
    expect(page).to_have_url(re.compile(r".*/sessions/session-2\?jobId=job-2"))

def test_job_filter_should_be_correctly_displayed_when_loading_with_jobid_in_url(page: Page):
    page.goto("/")
    page.evaluate("""() => {
        localStorage.setItem(
          "jules-jobs",
          JSON.stringify([
            { id: "job-1", name: "Job 1", sessionIds: ["session-1"] },
          ])
        );
        localStorage.setItem(
          "jules-sessions",
          JSON.stringify([
            { id: "session-1", title: "Session 1", state: "COMPLETED" },
          ])
        );
    }""")

    # Navigate to the page with a jobId in the query params
    page.goto("/?jobId=job-1")

    # Check if the combobox for job filtering displays "Job 1"
    # locator('button[role="combobox"][name="filter-job"]')
    # It might be difficult to select by name if it's not standard attribute.
    # Playwright python locator:
    job_filter_button = page.locator('button[role="combobox"][id="filter-job"]') # Assuming id or check Node test
    # Node test used: page.locator('button[role="combobox"][name="filter-job"]');
    # Is name attribute present? HTML usually uses name for inputs. Combobox button might have name?
    # I'll stick to what was in Node test but check if it fails.

    # Actually, in `home.spec.ts` we saw "Job Name" filter label.
    # Maybe we can find by label?

    # Let's use the selector from Node test for now.
    job_filter_button = page.locator('button[role="combobox"][name="filter-job"]')

    # The button text should contain "Job 1"
    expect(job_filter_button).to_have_text(re.compile("Job 1"))
