
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../src/lib/db';

export default async () => {
  migrate(db, { migrationsFolder: 'src/lib/db/migrations' });
};
