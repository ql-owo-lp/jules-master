
import '@testing-library/jest-dom';
import { vi } from 'vitest';
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

migrate(db, { migrationsFolder: 'src/lib/db/migrations' });
