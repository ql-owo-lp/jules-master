
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index';
import path from 'path';
import { seedProfiles } from './seed-profiles';

async function main() {
  console.log('Running migrations...');
  const migrationsFolder = path.join(process.cwd(), 'src/lib/db/migrations');
  await migrate(db, { migrationsFolder });
  console.log('Migrations completed.');

  console.log('Running data seeding...');
  await seedProfiles();
  console.log('Data seeding completed.');
}

main().catch((err) => {
  console.error('Migration failed!', err);
  process.exit(1);
});
