
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'sqlite.db');
const db = new Database(dbPath);

console.log('Cleaning DB...');
try {
  db.prepare('DELETE FROM sessions').run();
  db.prepare('DELETE FROM jobs').run();
  db.prepare('DELETE FROM cron_jobs').run();
  console.log('DB Cleaned.');
} catch (e) {
  console.error('Error cleaning DB:', e);
}
db.close();
