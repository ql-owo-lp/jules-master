import '@testing-library/jest-dom';
import { beforeAll } from 'vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../src/lib/db';
import path from 'path';

beforeAll(async () => {
  const migrationsFolder = path.join(process.cwd(), 'src/lib/db/migrations');
  await migrate(db, { migrationsFolder });
});
