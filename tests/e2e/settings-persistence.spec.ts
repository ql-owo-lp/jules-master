
import { test, expect } from '@playwright/test';

test.describe('Settings Persistence', () => {
  test('should prioritize local storage over database', async ({ page }) => {
    // Mock DB to return a specific value
    await page.route('/api/settings', async route => {
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

    await page.goto('/');
    await page.getByRole('button', { name: 'Open settings' }).click();

    // Expect LS value (5) not DB value (20)
    await expect(page.getByLabel('Default Session Count for New Jobs')).toHaveValue('5');

    // Expect LS value (111) not DB value (999)
    await expect(page.getByLabel('Idle Poll Interval (seconds)')).toHaveValue('111');

    // Verify theme is from LS (light) not DB (dark).
    // next-themes puts class "light" or "dark" on html element.
    await expect(page.locator('html')).toHaveClass(/light/);
  });

  test('should fallback to database when local storage is empty', async ({ page }) => {
     // Mock DB
     await page.route('/api/settings', async route => {
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

     await page.goto('/');
     await page.getByRole('button', { name: 'Open settings' }).click();

     // Expect DB value (15)
     await expect(page.getByLabel('Default Session Count for New Jobs')).toHaveValue('15');

     // Verify other fields fallback to DB
     await expect(page.getByLabel('Idle Poll Interval (seconds)')).toHaveValue('120');
     await expect(page.getByLabel('Active Poll Interval (seconds)')).toHaveValue('30');
     await expect(page.getByLabel('Session Title Truncation Length')).toHaveValue('50');
     await expect(page.getByLabel('Activity Feed Line Clamp')).toHaveValue('1');
     await expect(page.getByLabel('Sessions Per Page (within a job)')).toHaveValue('10');
     await expect(page.getByLabel('Jobs Per Page')).toHaveValue('5');
     await expect(page.getByLabel('PR Status Cache Refresh Interval (seconds)')).toHaveValue('60');

     // Expect Theme from DB (dark)
     await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('should save settings to database', async ({ page }) => {
    // Mock DB for initial load
    await page.route('/api/settings', async route => {
         if (route.request().method() === 'GET') {
             await route.fulfill({ json: {
                 defaultSessionCount: 10,
                 idlePollInterval: 120,
                 activePollInterval: 30,
                 titleTruncateLength: 50,
                 lineClamp: 1,
                 sessionItemsPerPage: 10,
                 jobsPerPage: 5,
                 prStatusPollInterval: 60,
                 theme: 'system'
              } });
         } else if (route.request().method() === 'POST') {
             // Verify the payload
             const postData = route.request().postDataJSON();
             // Verify all fields are present and correct
             if (
                 postData.defaultSessionCount === 7 &&
                 postData.idlePollInterval === 123 &&
                 postData.activePollInterval === 33 &&
                 postData.titleTruncateLength === 55 &&
                 postData.lineClamp === 2 &&
                 postData.sessionItemsPerPage === 15 &&
                 postData.jobsPerPage === 6 &&
                 postData.prStatusPollInterval === 90 &&
                 postData.theme !== undefined
             ) {
                 await route.fulfill({ json: { success: true } });
             } else {
                 console.log('Failed payload:', postData);
                 await route.fulfill({ status: 500 });
             }
         }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Open settings' }).click();

    await page.getByLabel('Default Session Count for New Jobs').fill('7');
    await page.getByLabel('Idle Poll Interval (seconds)').fill('123');
    await page.getByLabel('Active Poll Interval (seconds)').fill('33');
    await page.getByLabel('Session Title Truncation Length').fill('55');
    await page.getByLabel('Activity Feed Line Clamp').fill('2');
    await page.getByLabel('Sessions Per Page (within a job)').fill('15');
    await page.getByLabel('Jobs Per Page').fill('6');
    await page.getByLabel('PR Status Cache Refresh Interval (seconds)').fill('90');

    // Trigger save
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // We expect the success toast or confirmation.
    await expect(page.getByText('Your settings have been updated')).toBeVisible();
  });
});
