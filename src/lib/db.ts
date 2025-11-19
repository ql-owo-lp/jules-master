
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.JULES_MASTER_DB_PATH || path.join(process.cwd(), 'data', 'database.db');

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

function initializeDatabase() {
  const schema = `
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      model TEXT,
      temperature REAL,
      frequency_penalty REAL,
      presence_penalty REAL
    );

    CREATE TABLE IF NOT EXISTS predefined_prompts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quick_replies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS global_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `;
  db.exec(schema);

  // Initialize global settings with a default global prompt
  const stmt = db.prepare('INSERT OR IGNORE INTO global_settings (key, value) VALUES (?, ?)');
  stmt.run('globalPrompt', '');
}

initializeDatabase();

export default db;
