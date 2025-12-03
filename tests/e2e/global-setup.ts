
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../../src/lib/db';
import path from 'path';

async function globalSetup() {
  console.log('Running migrations for Playwright tests...');
  const migrationsFolder = path.join(process.cwd(), 'src/lib/db/migrations');
  await migrate(db, { migrationsFolder });
  console.log('Migrations completed for Playwright tests.');
}

export default globalSetup;
