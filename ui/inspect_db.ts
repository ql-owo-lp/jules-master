
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data/sqlite.db');
const db = new Database(dbPath, { readonly: true });

console.log('--- Settings Table Info ---');
try {
    const settingsInfo = db.prepare("PRAGMA table_info(settings)").all();
    console.table(settingsInfo);
} catch (e) {
    console.log("Settings table does not exist or error:", (e as any).message);
}

console.log('\n--- Jobs Table Info ---');
try {
    const jobsInfo = db.prepare("PRAGMA table_info(jobs)").all();
    console.table(jobsInfo);
} catch (e) {
    console.log("Jobs table does not exist or error:", (e as any).message);
}
