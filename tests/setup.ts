
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../src/lib/db';
import * as schema from '../src/lib/db/schema';

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.stubGlobal('ResizeObserver', ResizeObserver);

// Mock next/headers
vi.mock('next/headers', () => {
  return {
    cookies: () => ({
      get: (name: string) => ({ value: 'test-profile-id' }),
      getAll: () => [],
      has: () => true,
      set: () => {},
      delete: () => {},
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

migrate(db, { migrationsFolder: 'src/lib/db/migrations' });

// Insert default profile for tests
try {
    db.insert(schema.profiles).values({
        id: 'test-profile-id',
        name: 'Test Profile',
        createdAt: new Date().toISOString(),
    }).run();
} catch (e) {
    // Ignore unique constraint error if it runs multiple times or setup logic runs repeatedly
}
