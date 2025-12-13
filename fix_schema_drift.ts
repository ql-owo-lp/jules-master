
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data/sqlite.db');
console.log(`Opening database at ${dbPath}`);
const db = new Database(dbPath);

const changes = [
    // Settings table updates
    { table: 'settings', column: 'auto_delete_stale_branches_interval', type: 'integer DEFAULT 1800 NOT NULL' },
    { table: 'settings', column: 'retry_timeout', type: 'integer DEFAULT 1200 NOT NULL' },
    { table: 'settings', column: 'profile_id', type: "text DEFAULT 'default' NOT NULL REFERENCES profiles(id)" },
    
    // Profile ID updates for other tables
    { table: 'jobs', column: 'profile_id', type: "text DEFAULT 'default' NOT NULL REFERENCES profiles(id)" },
    { table: 'cron_jobs', column: 'profile_id', type: "text DEFAULT 'default' NOT NULL REFERENCES profiles(id)" },
    { table: 'global_prompt', column: 'profile_id', type: "text DEFAULT 'default' NOT NULL REFERENCES profiles(id)" },
    { table: 'history_prompts', column: 'profile_id', type: "text DEFAULT 'default' NOT NULL REFERENCES profiles(id)" },
    { table: 'predefined_prompts', column: 'profile_id', type: "text DEFAULT 'default' NOT NULL REFERENCES profiles(id)" },
    { table: 'quick_replies', column: 'profile_id', type: "text DEFAULT 'default' NOT NULL REFERENCES profiles(id)" },
    { table: 'repo_prompts', column: 'profile_id', type: "text DEFAULT 'default' NOT NULL REFERENCES profiles(id)" },
    { table: 'sessions', column: 'profile_id', type: "text DEFAULT 'default' NOT NULL REFERENCES profiles(id)" },
];

// Ensure profiles table exists first (if totally missing)
const profilesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profiles'").get();
if (!profilesTable) {
    console.log("Creating missing 'profiles' table...");
    db.exec(`CREATE TABLE IF NOT EXISTS profiles (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        created_at text NOT NULL
    )`);
    // Insert default profile
    db.exec(`INSERT OR IGNORE INTO profiles (id, name, created_at) VALUES ('default', 'Default', datetime('now'))`);
}

for (const change of changes) {
    try {
        console.log(`Checking ${change.table}.${change.column}...`);
        const tableInfo = db.prepare(`PRAGMA table_info(${change.table})`).all() as any[];
        const hasColumn = tableInfo.some(col => col.name === change.column);
        
        if (!hasColumn) {
            console.log(`  Adding column ${change.column} to ${change.table}...`);
            db.exec(`ALTER TABLE ${change.table} ADD COLUMN ${change.column} ${change.type}`);
        } else {
            console.log(`  Column already exists.`);
        }
    } catch (error) {
        console.error(`  Failed to update ${change.table}:`, error.message);
    }
}

console.log('Schema patch completed.');
