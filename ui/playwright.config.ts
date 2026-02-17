import { defineConfig, devices } from '@playwright/test';
const port = process.env.PLAYWRIGHT_PORT ? parseInt(process.env.PLAYWRIGHT_PORT) : 3000;
const baseURL = process.env.TEST_TARGET_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: 'list',
    timeout: 120000,
    expect: {
        timeout: 30000,
    },
    use: {
      baseURL,
      trace: 'on',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
    webServer: process.env.TEST_SKIP_WEBSERVER ? undefined : {
      command: `sh scripts/start-e2e.sh ${port}`,
      url: baseURL,
      env: {
        DATABASE_URL: 'e2e_jules.db', // Ensure consistency if passed down
      },
      env: {
        DATABASE_URL: 'e2e_jules.db', // Ensure consistency if passed down
      },
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'ignore',
      timeout: 300 * 1000,
    },
});
