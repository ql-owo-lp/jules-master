
import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';
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
