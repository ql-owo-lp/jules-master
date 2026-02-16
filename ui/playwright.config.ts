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
      command: `rm -f e2e_jules.db && export DATABASE_URL=e2e_jules.db; sh -c "./node_modules/.bin/tsx src/lib/db/migrate.ts && ./node_modules/.bin/tsx scripts/seed-e2e.ts && (cd ../server && CGO_ENABLED=1 go run cmd/server/main.go 2>&1 | tee /app/backend.log &) && ./node_modules/.bin/tsx scripts/wait-for-backend.ts && MOCK_API=false PORT=50051 JULES_API_KEY='${process.env.JULES_API_KEY || 'mock-api-key'}' DATABASE_URL=e2e_jules.db ./node_modules/.bin/next start -H 127.0.0.1 -p ${port}"`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'ignore',
      timeout: 300 * 1000,
    },
});
