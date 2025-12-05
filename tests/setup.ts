
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../src/lib/db';
import fs from 'fs';

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

// Delete the database file before running migrations
if (fs.existsSync('data/sqlite.db')) {
  fs.unlinkSync('data/sqlite.db');
}

migrate(db, { migrationsFolder: 'src/lib/db/migrations' });
