
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

const DB_PATH = process.env.JULES_MASTER_DB_PATH || './jules-master.db';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
    if (db) {
        return db;
    }

    db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database,
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            name TEXT,
            session_ids TEXT,
            created_at TEXT,
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

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);

    return db;
}
