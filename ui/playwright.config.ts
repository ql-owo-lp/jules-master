import { defineConfig, devices } from '@playwright/test';
const port = process.env.PLAYWRIGHT_PORT ? parseInt(process.env.PLAYWRIGHT_PORT) : 9002;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'line',
    use: {
      baseURL,
      trace: 'on-first-retry',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
    webServer: {
      command: `(cd ../server && go run cmd/server/main.go) & MOCK_API=true JULES_API_KEY=${process.env.JULES_API_KEY || 'mock-api-key'} npm run dev -- -p ${port}`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
      timeout: 120 * 1000,
    },
});
