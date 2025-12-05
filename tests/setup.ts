
import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../src/lib/db';
import { profiles } from '../src/lib/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';

// Mock ResizeObserver
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.stubGlobal('ResizeObserver', ResizeObserver);

// Run migrations once
migrate(db, { migrationsFolder: 'src/lib/db/migrations' });

// Setup default profile for all tests
beforeEach(async () => {
  vi.clearAllMocks();

  // Ensure a default active profile exists
  // We need to catch error here because if migration failed or DB is locked, this might fail.
  try {
      const activeProfile = await db.select().from(profiles).where(eq(profiles.isActive, true)).limit(1);
      if (activeProfile.length === 0) {
          await db.insert(profiles).values({
              id: uuidv4(),
              name: 'Test Profile',
              isActive: true,
              createdAt: new Date().toISOString()
          });
      }
  } catch (e) {
      console.error("Test setup failed to check/create profile:", e);
  }
});
