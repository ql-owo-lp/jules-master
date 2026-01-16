
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index';
import path from 'path';

async function main() {
  console.log('Running migrations...');
  const migrationsFolder = path.join(process.cwd(), 'src/lib/db/migrations');
  await migrate(db, { migrationsFolder });
  console.log('Migrations completed.');
}

main().catch((err) => {
  console.error('Migration failed!', err);
  process.exit(1);
});
