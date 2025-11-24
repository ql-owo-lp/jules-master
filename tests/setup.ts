
import '@testing-library/jest-dom/vitest';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../src/lib/db';

migrate(db, { migrationsFolder: 'src/lib/db/migrations' });
