
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { profiles, predefinedPrompts, quickReplies, globalPrompt, settings, jobs, sessions } from '../src/lib/db/schema';
import path from 'path';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL is not set');
}

// Handle relative/absolute path for better-sqlite3
const dbPath = path.isAbsolute(dbUrl) ? dbUrl : path.join(process.cwd(), dbUrl);
console.log(`Seeding database at ${dbPath}...`);

const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

async function main() {
  console.log('Running migrations...');
  const migrationsFolder = path.join(process.cwd(), 'src/lib/db/migrations');
  await migrate(db, { migrationsFolder });
  console.log('Migrations completed.');

  const timestamp = new Date().toISOString();

  // 1. Create Default Profile
  try {
    const existing = await db.select().from(profiles).where(eq(profiles.id, 'default'));
    if (!existing.length) {
      await db.insert(profiles).values({
        id: 'default',
        name: 'Default Profile',
        createdAt: timestamp,
      });
      console.log('Inserted default profile.');
    }
  } catch (e) {
    console.error('Error inserting profile:', e);
  }

  // 2. Settings (ensure default exists)
  try {
    const existingSettings = await db.select().from(settings).limit(1);
    if (!existingSettings.length) {
      await db.insert(settings).values({
        id: 1,
        profileId: 'default',
      });
      console.log('Inserted default settings.');
    }
  } catch (e) {
    console.error('Error inserting settings:', e);
  }

  // 3. Global Prompt
  try {
    const existingGlobalPrompt = await db.select().from(globalPrompt).where(eq(globalPrompt.id, 1));
    if (!existingGlobalPrompt.length) {
      await db.insert(globalPrompt).values({
        id: 1,
        prompt: 'You are a helpful assistant.',
        profileId: 'default',
      });
      console.log('Inserted global prompt.');
    }
  } catch (e) {
    console.error('Error inserting global prompt:', e);
  }

  // 4. Predefined Prompts (Messages)
  try {
    const existingPredefined = await db.select().from(predefinedPrompts).where(eq(predefinedPrompts.id, 'msg-1'));
    if (!existingPredefined.length) {
      await db.insert(predefinedPrompts).values([
        {
          id: 'msg-1',
          title: 'Welcome',
          prompt: 'Hello world',
          profileId: 'default',
        }
      ]);
      console.log('Inserted predefined prompt.');
    }
  } catch (e) {
     console.error('Error inserting predefined prompt:', e);
  }

  // 5. Quick Replies
  try {
    const existingReply = await db.select().from(quickReplies).where(eq(quickReplies.id, 'reply-1'));
    if (!existingReply.length) {
      await db.insert(quickReplies).values([
        {
          id: 'reply-1',
          title: 'LGTM',
          prompt: 'Looks good to me',
          profileId: 'default',
        }
      ]);
      console.log('Inserted quick reply.');
    }
  } catch (e) {
    console.error('Error inserting quick reply:', e);
  }

  // 6. Jobs and Sessions (for filter-bug test)
  try {
    const existingJob = await db.select().from(jobs).where(eq(jobs.id, 'job-1'));
    if (!existingJob.length) {
      await db.insert(jobs).values([
          {
              id: 'job-1',
              name: 'Job 1',
              sessionIds: ['session-1'],
              createdAt: timestamp,
              repo: 'test/repo',
              branch: 'main',
              profileId: 'default',
              status: 'PENDING',
              autoApproval: false,
              background: false
          }
      ]);
      console.log('Inserted job.');
    }
  } catch (e) {
     console.error('Error inserting job:', e);
  }

  try {
    const existingSession = await db.select().from(sessions).where(eq(sessions.id, 'session-1'));
    if (!existingSession.length) {
      await db.insert(sessions).values([
          {
              id: 'session-1',
              name: 'Session 1',
              title: 'Session 1',
              prompt: 'Test Prompt',
              state: 'COMPLETED',
              lastUpdated: Date.now(),
              profileId: 'default'
          }
      ]);
      console.log('Inserted session.');
    }

    const existingMock1 = await db.select().from(sessions).where(eq(sessions.id, 'mock-1'));
    if (!existingMock1.length) {
       await db.insert(sessions).values([
          {
              id: 'mock-1',
              name: 'Mock Session 1',
              title: 'Mock Session 1',
              prompt: 'Mock Prompt 1',
              state: 'COMPLETED',
              lastUpdated: Date.now(),
              profileId: 'default'
          }
       ]);
       console.log('Inserted Mock Session 1.');
    }

    const existingMock2 = await db.select().from(sessions).where(eq(sessions.id, 'mock-2'));
    if (!existingMock2.length) {
       await db.insert(sessions).values([
          {
              id: 'mock-2',
              name: 'Mock Session 2',
              title: 'Mock Session 2',
              prompt: 'Mock Prompt 2',
              state: 'AWAITING_USER_FEEDBACK', // Matches test expectation
              lastUpdated: Date.now(),
              profileId: 'default'
          }
       ]);
       console.log('Inserted Mock Session 2.');
    }
  } catch(e) {
     console.error('Error inserting session:', e);
  }

  console.log('Seeding completed.');
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
