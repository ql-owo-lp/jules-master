
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'sqlite.db');
const db = new Database(dbPath);

try {
  const tableInfo = db.prepare("PRAGMA table_info(cron_jobs)").all();
  console.log('cron_jobs columns:', tableInfo.map(c => c.name));
} catch (e) {
  console.error(e);
}
db.close();
