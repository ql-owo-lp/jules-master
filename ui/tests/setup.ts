
import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

vi.mock('better-sqlite3', () => {
  return {
    default: class {
      prepare = vi.fn().mockReturnValue({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn(),
        raw: vi.fn(),
        iterate: vi.fn(),
      });
      exec = vi.fn();
      pragma = vi.fn();
      function = vi.fn();
      transaction = vi.fn().mockReturnValue((cb: any) => cb);
    },
  };
});

vi.mock('drizzle-orm/better-sqlite3/migrator', () => ({
  migrate: vi.fn(),
}));

vi.mock('@/lib/grpc-client', () => ({
    settingsClient: { getSettings: vi.fn(), updateSettings: vi.fn() },
    profileClient: { listProfiles: vi.fn(), createProfile: vi.fn(), deleteProfile: vi.fn() },
    logClient: { getLogs: vi.fn() },
    cronJobClient: { listCronJobs: vi.fn(), createCronJob: vi.fn(), deleteCronJob: vi.fn(), updateCronJob: vi.fn(), toggleCronJob: vi.fn(), executeCronJob: vi.fn() },
    jobClient: { listJobs: vi.fn(), createJob: vi.fn(), getJob: vi.fn(), deleteJob: vi.fn(), updateJob: vi.fn() },
    promptClient: { listPredefinedPrompts: vi.fn(), getPrompt: vi.fn(), listHistoryPrompts: vi.fn(), getRepoPrompt: vi.fn() },
    sessionClient: { listSessions: vi.fn(), getSession: vi.fn(), createSession: vi.fn(), deleteSession: vi.fn() },
}));

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../src/lib/db';

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.stubGlobal('ResizeObserver', ResizeObserver);

beforeEach(() => {
  vi.clearAllMocks();
});

import { profiles } from '../src/lib/db/schema';
// ... other imports

// ... existing code ...

migrate(db, { migrationsFolder: 'src/lib/db/migrations' });

try {
  db.insert(profiles).values({ 
    id: 'default', 
    name: 'Default Profile',
    createdAt: new Date().toISOString()
  }).run();
} catch (e) {
  // Ignore if already exists (shouldn't happen in fresh DB but safe)
}
