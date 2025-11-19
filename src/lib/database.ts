
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';

let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function getDb() {
  if (!db) {
    db = await open({
      filename: './data/database.db',
      driver: sqlite3.Database
    });
    await db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        name TEXT,
        repo TEXT,
        branch TEXT,
        created_at TEXT,
        raw_json TEXT
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
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt TEXT
      );
    `);
  }
  return db;
}
