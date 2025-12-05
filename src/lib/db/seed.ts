
import { db } from './index';
import * as schema from './schema';

async function main() {
  console.log('Seeding database...');
  await db.insert(schema.settings).values({
    id: 1,
    autoApprovalInterval: 60,
  }).onConflictDoNothing().execute();
  console.log('Database seeded.');
}

main();
