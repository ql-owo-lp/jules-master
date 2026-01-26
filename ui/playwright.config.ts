import { defineConfig, devices } from '@playwright/test';
const port = process.env.PLAYWRIGHT_PORT ? parseInt(process.env.PLAYWRIGHT_PORT) : 9002;
const baseURL = process.env.TEST_TARGET_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: 'list',
    timeout: 60000,
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
      command: `rm -f /tmp/e2e_jules.db && export DATABASE_URL=/tmp/e2e_jules.db; sh -c "tsx src/lib/db/migrate.ts && tsx scripts/seed-e2e.ts && (([ -f /app/server_bin ] && /app/server_bin > /tmp/backend.log 2>&1) || ([ -f ./server_bin ] && ./server_bin > /tmp/backend.log 2>&1) || (cd ../server && go run cmd/server/main.go > /tmp/backend.log 2>&1) &) && tsx scripts/wait-for-backend.ts && MOCK_API=false JULES_API_KEY=${process.env.JULES_API_KEY || 'mock-api-key'} DATABASE_URL=/tmp/e2e_jules.db next dev -p ${port}"`,
      url: baseURL,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120 * 1000,
    },
});
