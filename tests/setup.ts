
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../src/lib/db';
import '@testing-library/jest-dom';

migrate(db, { migrationsFolder: 'src/lib/db/migrations' });
