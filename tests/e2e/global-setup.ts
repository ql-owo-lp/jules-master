
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../../src/lib/db';
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Run database migrations
  migrate(db, { migrationsFolder: 'src/lib/db/migrations' });
}

export default globalSetup;
