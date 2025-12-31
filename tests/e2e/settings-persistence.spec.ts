
import { test, expect } from '@playwright/test';

test.describe('Settings Persistence', () => {
  test.setTimeout(60000); // Increase timeout for persistence tests

  test('should prioritize database over local storage', async ({ page }) => {
    // Mock DB to return a specific value
    await page.route('/api/settings*', async route => { // Match query params
      const json = {
        idlePollInterval: 999,
        activePollInterval: 888,
        titleTruncateLength: 777,
        lineClamp: 2,
        sessionItemsPerPage: 5,
        jobsPerPage: 2,
        defaultSessionCount: 20,
        prStatusPollInterval: 120,
        theme: 'dark'
      };
      await route.fulfill({ json });
    });

    // Set local storage to something else
    await page.addInitScript(() => {
      window.localStorage.setItem('jules-default-session-count', '5');
      window.localStorage.setItem('jules-idle-poll-interval', '111');
      window.localStorage.setItem('theme', 'light');
    });

    await page.goto('/settings');

    // Expect DB value (20) not LS value (5)
    await expect(page.getByLabel('Default Session Count for New Jobs')).toHaveValue('20');

    // Expect DB value (999) not LS value (111)
    await expect(page.getByLabel('Idle Poll Interval (seconds)')).toHaveValue('999');

    // Verify theme is from DB (dark) not LS (light)
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('should fallback to database when local storage is empty', async ({ page }) => {
     // Mock DB
     await page.route('/api/settings*', async route => {
        const json = {
            idlePollInterval: 120,
            activePollInterval: 30,
            titleTruncateLength: 50,
            lineClamp: 1,
            sessionItemsPerPage: 10,
            jobsPerPage: 5,
            defaultSessionCount: 15, // Different from default 10
            prStatusPollInterval: 60,
            theme: 'dark'
        };
        await route.fulfill({ json });
     });

     // Local storage is empty by default in a new context

     await page.goto('/settings');

     // Expect DB value (15)
     await expect(page.getByLabel('Default Session Count for New Jobs')).toHaveValue('15');
     await expect(page.getByLabel('Idle Poll Interval (seconds)')).toHaveValue('120');
     await expect(page.getByLabel('Active Poll Interval (seconds)')).toHaveValue('30');
     await expect(page.getByLabel('PR Status Cache Refresh Interval (seconds)')).toHaveValue('60');

     // Switch to Display tab
     await page.getByRole('tab', { name: 'Display' }).click();

     await expect(page.getByLabel('Session Title Truncation Length')).toHaveValue('50');
     await expect(page.getByLabel('Activity Feed Line Clamp')).toHaveValue('1');
     await expect(page.getByLabel('Sessions Per Page (within a job)')).toHaveValue('10');
     await expect(page.getByLabel('Jobs Per Page')).toHaveValue('5');

     // Expect Theme from DB (dark)
     await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('should save settings to database', async ({ page }) => {
    let dbSettings = {
        defaultSessionCount: 10,
        idlePollInterval: 120,
        activePollInterval: 30,
        titleTruncateLength: 50,
        lineClamp: 1,
        sessionItemsPerPage: 10,
        jobsPerPage: 5,
        prStatusPollInterval: 60,
        theme: 'system'
    };

    // Mock DB for initial load
    await page.route('/api/settings*', async route => {
         if (route.request().method() === 'GET') {
             await route.fulfill({ json: dbSettings });
         } else if (route.request().method() === 'POST') {
             // Verify the payload
             const postData = route.request().postDataJSON();

             // Update dbSettings with posted data to simulate persistence
             dbSettings = { ...dbSettings, ...postData };

             // We have two save actions now.
             // 1. Config Save: defaultSessionCount, idlePollInterval, activePollInterval, prStatusPollInterval
             // 2. Display Save: titleTruncateLength, lineClamp, sessionItemsPerPage, jobsPerPage

             // Check if it's the Config save (based on unique values we set)
             if (postData.defaultSessionCount === 7 && postData.idlePollInterval === 123) {
                 if (
                    postData.activePollInterval === 33 &&
                    postData.prStatusPollInterval === 90 &&
                    // Other fields should remain default (from initial GET)
                    postData.titleTruncateLength === 50
                 ) {
                     await route.fulfill({ json: { success: true } });
                     return;
                 }
             }

             // Check if it's the Display save
             if (postData.titleTruncateLength === 55 && postData.lineClamp === 2) {
                  if (
                    postData.sessionItemsPerPage === 15 &&
                    postData.jobsPerPage === 6 &&
                    // Config fields should retain their UPDATED values because the app doesn't refetch?
                    // Actually, the component state holds the values.
                    // So if we updated Config fields in the UI, they should be present here too.
                    postData.defaultSessionCount === 7
                 ) {
                     await route.fulfill({ json: { success: true } });
                     return;
                 }
             }

             console.log('Failed payload:', postData);
             await route.fulfill({ status: 500 });
         }
    });

    await page.goto('/settings');

    await page.getByLabel('Default Session Count for New Jobs').fill('7');
    await page.getByLabel('Idle Poll Interval (seconds)').fill('123');
    await page.getByLabel('Active Poll Interval (seconds)').fill('33');
    await page.getByLabel('PR Status Cache Refresh Interval (seconds)').fill('90');

    // Save General Settings (General tab)
    await page.getByRole('button', { name: 'Save General Settings' }).click();
    await expect(page.getByText('Settings Saved', { exact: true })).toBeVisible();
    await expect(page.getByText('Your settings have been updated.', { exact: true })).toBeVisible();

    // Wait for toast to disappear or dismiss it to avoid overlapping match
    await page.getByRole('button', { name: 'Close' }).click({ timeout: 2000 }).catch(() => {});

    // Wait for any overlays to disappear
    await page.waitForTimeout(500);

    // Switch to Display tab
    const displayTab = page.getByRole('tab', { name: 'Display' });
    await expect(displayTab).toBeVisible();
    await displayTab.click({ force: true });

    await page.getByLabel('Session Title Truncation Length').fill('55');
    await page.getByLabel('Activity Feed Line Clamp').fill('2');
    await page.getByLabel('Sessions Per Page (within a job)').fill('15');
    await page.getByLabel('Jobs Per Page').fill('6');

    // Save Display
    await page.getByRole('button', { name: 'Save Display Settings' }).click();
    await expect(page.getByText('Settings Saved', { exact: true })).toBeVisible();
  });
});
