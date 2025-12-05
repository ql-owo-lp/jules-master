
import re
from playwright.sync_api import Page, expect

def test_should_prioritize_local_storage_over_database(page: Page):
    # Mock DB to return a specific value
    def handle_api_settings(route):
        json_data = {
            "idlePollInterval": 999,
            "activePollInterval": 888,
            "titleTruncateLength": 777,
            "lineClamp": 2,
            "sessionItemsPerPage": 5,
            "jobsPerPage": 2,
            "defaultSessionCount": 20,
            "prStatusPollInterval": 120,
            "theme": 'dark'
        }
        route.fulfill(json=json_data)

    page.route("/api/settings", handle_api_settings)

    # Set local storage to something else
    page.add_init_script("""
      window.localStorage.setItem('jules-default-session-count', '5');
      window.localStorage.setItem('jules-idle-poll-interval', '111');
      window.localStorage.setItem('theme', 'light');
    """)

    page.goto("/settings")

    # Switch to Configuration tab for Default Session Count and Poll Intervals
    page.get_by_role("tab", name="Configuration").click()

    # Expect LS value (5) not DB value (20)
    expect(page.get_by_label("Default Session Count for New Jobs")).to_have_value("5")

    # Expect LS value (111) not DB value (999)
    expect(page.get_by_label("Idle Poll Interval (seconds)")).to_have_value("111")

    # Verify theme is from LS (light) not DB (dark).
    expect(page.locator("html")).to_have_class(re.compile(r"light"))

def test_should_fallback_to_database_when_local_storage_is_empty(page: Page):
     # Mock DB
     def handle_api_settings(route):
        json_data = {
            "idlePollInterval": 120,
            "activePollInterval": 30,
            "titleTruncateLength": 50,
            "lineClamp": 1,
            "sessionItemsPerPage": 10,
            "jobsPerPage": 5,
            "defaultSessionCount": 15, # Different from default 10
            "prStatusPollInterval": 60,
            "theme": 'dark'
        }
        route.fulfill(json=json_data)

     page.route("/api/settings", handle_api_settings)

     # Local storage is empty by default in a new context

     page.goto("/settings")

     # Switch to Configuration tab
     page.get_by_role("tab", name="Configuration").click()

     # Expect DB value (15)
     expect(page.get_by_label("Default Session Count for New Jobs")).to_have_value("15")
     expect(page.get_by_label("Idle Poll Interval (seconds)")).to_have_value("120")
     expect(page.get_by_label("Active Poll Interval (seconds)")).to_have_value("30")
     expect(page.get_by_label("PR Status Cache Refresh Interval (seconds)")).to_have_value("60")

     # Switch to Display tab
     page.get_by_role("tab", name="Display").click()

     expect(page.get_by_label("Session Title Truncation Length")).to_have_value("50")
     expect(page.get_by_label("Activity Feed Line Clamp")).to_have_value("1")
     expect(page.get_by_label("Sessions Per Page (within a job)")).to_have_value("10")
     expect(page.get_by_label("Jobs Per Page")).to_have_value("5")

     # Expect Theme from DB (dark)
     expect(page.locator("html")).to_have_class(re.compile(r"dark"))

def test_should_save_settings_to_database(page: Page):
    # Mock DB for initial load
    def handle_api_settings(route):
         if route.request.method == 'GET':
             route.fulfill(json={
                 "defaultSessionCount": 10,
                 "idlePollInterval": 120,
                 "activePollInterval": 30,
                 "titleTruncateLength": 50,
                 "lineClamp": 1,
                 "sessionItemsPerPage": 10,
                 "jobsPerPage": 5,
                 "prStatusPollInterval": 60,
                 "theme": 'system'
              })
         elif route.request.method == 'POST':
             # Verify the payload
             post_data = route.request.post_data_json

             # Check if it's the Config save (based on unique values we set)
             if post_data.get("defaultSessionCount") == 7 and post_data.get("idlePollInterval") == 123:
                 if (
                    post_data.get("activePollInterval") == 33 and
                    post_data.get("prStatusPollInterval") == 90 and
                    # Other fields should remain default (from initial GET)
                    post_data.get("titleTruncateLength") == 50
                 ):
                     route.fulfill(json={"success": True})
                     return

             # Check if it's the Display save
             if post_data.get("titleTruncateLength") == 55 and post_data.get("lineClamp") == 2:
                  if (
                    post_data.get("sessionItemsPerPage") == 15 and
                    post_data.get("jobsPerPage") == 6 and
                    # Config fields should retain their UPDATED values because the app doesn't refetch?
                    # Actually, the component state holds the values.
                    # So if we updated Config fields in the UI, they should be present here too.
                    post_data.get("defaultSessionCount") == 7
                 ):
                     route.fulfill(json={"success": True})
                     return

             print('Failed payload:', post_data)
             route.fulfill(status=500)

    page.route("/api/settings", handle_api_settings)

    page.goto("/settings")

    # Switch to Configuration tab
    page.get_by_role("tab", name="Configuration").click()

    page.get_by_label("Default Session Count for New Jobs").fill("7")
    page.get_by_label("Idle Poll Interval (seconds)").fill("123")
    page.get_by_label("Active Poll Interval (seconds)").fill("33")
    page.get_by_label("PR Status Cache Refresh Interval (seconds)").fill("90")

    # Save Configuration
    page.get_by_role("button", name="Save Configuration").click()
    expect(page.get_by_text("Settings Saved", exact=True)).to_be_visible()
    expect(page.get_by_text("Your settings have been updated.", exact=True)).to_be_visible()

    # Wait for toast to disappear or dismiss it to avoid overlapping match
    try:
        page.get_by_role("button", name="Close").click(timeout=2000)
    except Exception:
        pass

    # Wait for any overlays to disappear
    page.wait_for_timeout(500)

    # Switch to Display tab
    display_tab = page.get_by_role("tab", name="Display")
    expect(display_tab).to_be_visible()
    display_tab.click(force=True)

    page.get_by_label("Session Title Truncation Length").fill("55")
    page.get_by_label("Activity Feed Line Clamp").fill("2")
    page.get_by_label("Sessions Per Page (within a job)").fill("15")
    page.get_by_label("Jobs Per Page").fill("6")

    # Save Display
    page.get_by_role("button", name="Save Display Settings").click()
    expect(page.get_by_text("Settings Saved", exact=True)).to_be_visible()
