
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const DB_PATH = process.env.JULES_DB_PATH || './data/database.db';

export async function initializeDatabase() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      name TEXT,
      sessionIds TEXT,
      createdAt TEXT,
      repo TEXT,
      branch TEXT
    );

    CREATE TABLE IF NOT EXISTS predefined_prompts (
      id TEXT PRIMARY KEY,
      title TEXT,
      prompt TEXT
    );

    CREATE TABLE IF NOT EXISTS quick_replies (
      id TEXT PRIMARY KEY,
      title TEXT,
      prompt TEXT
    );

    CREATE TABLE IF NOT EXISTS global_prompt (
      id INTEGER PRIMARY KEY DEFAULT 1,
      prompt TEXT
    );
  `);

  // Ensure the global_prompt table has a default row
  await db.run('INSERT OR IGNORE INTO global_prompt (id, prompt) VALUES (1, "")');


  return db;
}
