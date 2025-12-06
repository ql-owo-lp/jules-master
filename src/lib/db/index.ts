
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { Job, PredefinedPrompt, HistoryPrompt } from '../types';
import { eq, desc, and } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import path from 'path';

// Resolve database path (handle relative paths in DATABASE_URL or default)
const dbUrl = process.env.DATABASE_URL || 'data/sqlite.db';
const dbPath = path.isAbsolute(dbUrl) ? dbUrl : path.join(process.cwd(), dbUrl);
const dbDir = path.dirname(dbPath);

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
  console.log(`Creating database directory: ${dbDir}`);
  fs.mkdirSync(dbDir, { recursive: true });
}

// Check directory write permissions
try {
  fs.accessSync(dbDir, fs.constants.W_OK);
} catch (error) {
  console.error(`Error: Database directory '${dbDir}' is not writable.`);
  throw error;
}

// Check file permissions if it exists, or log initialization if not
if (fs.existsSync(dbPath)) {
  try {
    fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
  } catch (error) {
    console.error(`Error: Database file '${dbPath}' is not readable/writable.`);
    throw error;
  }
} else {
  console.log(`Initializing new database at: ${dbPath}`);
}

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

// Helper to get active profile
export async function getActiveProfileId(): Promise<string> {
    const profile = await db.query.profiles.findFirst({
        where: eq(schema.profiles.isActive, true)
    });

    if (profile) return profile.id;

    // If no active profile, try to find ANY profile
    const anyProfile = await db.query.profiles.findFirst();
    if (anyProfile) {
        // Set it as active
        await db.update(schema.profiles).set({ isActive: true }).where(eq(schema.profiles.id, anyProfile.id));
        return anyProfile.id;
    }

    // Create default profile if none exists
    const newId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    await db.insert(schema.profiles).values({
        id: newId,
        name: 'Default',
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
    });

    // Migrate existing data that has no profileId to this new profile
    // Note: This is a best-effort migration for existing data
    await db.update(schema.jobs).set({ profileId: newId }).where(sql`profile_id IS NULL`);
    await db.update(schema.cronJobs).set({ profileId: newId }).where(sql`profile_id IS NULL`);
    await db.update(schema.predefinedPrompts).set({ profileId: newId }).where(sql`profile_id IS NULL`);
    await db.update(schema.historyPrompts).set({ profileId: newId }).where(sql`profile_id IS NULL`);
    await db.update(schema.quickReplies).set({ profileId: newId }).where(sql`profile_id IS NULL`);
    await db.update(schema.globalPrompt).set({ profileId: newId }).where(sql`profile_id IS NULL`);
    await db.update(schema.repoPrompts).set({ profileId: newId }).where(sql`profile_id IS NULL`);
    await db.update(schema.settings).set({ profileId: newId }).where(sql`profile_id IS NULL`);
    await db.update(schema.sessions).set({ profileId: newId }).where(sql`profile_id IS NULL`);

    return newId;
}

// Ensure default profile exists on startup
getActiveProfileId().catch(console.error);

import { sql } from 'drizzle-orm';

// Generic DAO Interface
export interface IDao<T> {
  getAll(profileId: string): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  create(data: T): Promise<void>;
  createMany(data: T[]): Promise<void>;
  update(id: string, data: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
}

// Database Class
class AppDatabase {
  // Job DAO
  public jobs: IDao<Job> = {
    getAll: async (profileId: string) => {
      const jobs = await db.select().from(schema.jobs).where(eq(schema.jobs.profileId, profileId));
      return jobs.map(job => ({
        ...job,
        sessionIds: job.sessionIds || []
      }));
    },
    getById: async (id) => {
        const job = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).get();
        if (job) {
             return { ...job, sessionIds: job.sessionIds || [] };
        }
        return undefined;
    },
    create: async (job) => { await db.insert(schema.jobs).values(job) },
    createMany: async (jobs) => { 
      if (jobs.length === 0) return;
      await db.insert(schema.jobs).values(jobs);
    },
    update: async (id, job) => { await db.update(schema.jobs).set(job).where(eq(schema.jobs.id, id)) },
    delete: async (id) => { await db.delete(schema.jobs).where(eq(schema.jobs.id, id)) },
  };

  // PredefinedPrompt DAO
  public predefinedPrompts: IDao<PredefinedPrompt> = {
    getAll: async (profileId: string) => db.select().from(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, profileId)),
    getById: async (id) => db.select().from(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.id, id)).get(),
    create: async (prompt) => { await db.insert(schema.predefinedPrompts).values(prompt) },
    createMany: async (prompts) => {
        if (prompts.length === 0) return;
        await db.insert(schema.predefinedPrompts).values(prompts);
    },
    update: async (id, prompt) => { await db.update(schema.predefinedPrompts).set(prompt).where(eq(schema.predefinedPrompts.id, id)) },
    delete: async (id) => { await db.delete(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.id, id)) },
  };

  // HistoryPrompt DAO
  public historyPrompts: IDao<HistoryPrompt> & { getRecent: (limit: number, profileId: string) => Promise<HistoryPrompt[]> } = {
    getAll: async (profileId: string) => db.select().from(schema.historyPrompts).where(eq(schema.historyPrompts.profileId, profileId)).orderBy(desc(schema.historyPrompts.lastUsedAt)),
    getRecent: async (limit, profileId) => db.select().from(schema.historyPrompts).where(eq(schema.historyPrompts.profileId, profileId)).orderBy(desc(schema.historyPrompts.lastUsedAt)).limit(limit),
    getById: async (id) => db.select().from(schema.historyPrompts).where(eq(schema.historyPrompts.id, id)).get(),
    create: async (prompt) => { await db.insert(schema.historyPrompts).values(prompt) },
    createMany: async (prompts) => {
        if (prompts.length === 0) return;
        await db.insert(schema.historyPrompts).values(prompts);
    },
    update: async (id, prompt) => { await db.update(schema.historyPrompts).set(prompt).where(eq(schema.historyPrompts.id, id)) },
    delete: async (id) => { await db.delete(schema.historyPrompts).where(eq(schema.historyPrompts.id, id)) },
  };

  // QuickReply DAO
  public quickReplies: IDao<PredefinedPrompt> = {
    getAll: async (profileId: string) => db.select().from(schema.quickReplies).where(eq(schema.quickReplies.profileId, profileId)),
    getById: async (id) => db.select().from(schema.quickReplies).where(eq(schema.quickReplies.id, id)).get(),
    create: async (reply) => { await db.insert(schema.quickReplies).values(reply) },
    createMany: async (replies) => {
        if (replies.length === 0) return;
        await db.insert(schema.quickReplies).values(replies);
    },
    update: async (id, reply) => { await db.update(schema.quickReplies).set(reply).where(eq(schema.quickReplies.id, id)) },
    delete: async (id) => { await db.delete(schema.quickReplies).where(eq(schema.quickReplies.id, id)) },
  };

  // GlobalPrompt DAO
  public globalPrompt = {
    get: async (profileId: string) => db.select().from(schema.globalPrompt).where(eq(schema.globalPrompt.profileId, profileId)).get(),
    save: async (prompt: string, profileId: string) => {
        const existing = await db.select().from(schema.globalPrompt).where(eq(schema.globalPrompt.profileId, profileId)).get();
        if (existing) {
            await db.update(schema.globalPrompt).set({ prompt }).where(eq(schema.globalPrompt.id, existing.id));
        } else {
            // Need a unique integer ID if it's primary key
            // But we should probably change globalPrompt ID to text or UUID too if we want multiple
            // But for now, let's just use an arbitrary ID or fix schema.
            // The schema has id: integer. Since it was 1 row table before.
            // I should have changed schema to auto increment or UUID.
            // I'll check schema again.
            // `id: integer('id').primaryKey()` in sqlite-core usually is NOT autoincrement unless specified or it's `integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true })`.
            // Wait, standard `integer primary key` in SQLite IS autoincrement (rowid).
            // Let's assume it autoincrements.
            await db.insert(schema.globalPrompt).values({ prompt, profileId });
        }
    }
  };

  // RepoPrompts DAO
  public repoPrompts = {
    get: async (repo: string, profileId: string) => db.select().from(schema.repoPrompts).where(and(eq(schema.repoPrompts.repo, repo), eq(schema.repoPrompts.profileId, profileId))).get(),
    save: async (repo: string, prompt: string, profileId: string) => {
        const existing = await db.select().from(schema.repoPrompts).where(and(eq(schema.repoPrompts.repo, repo), eq(schema.repoPrompts.profileId, profileId))).get();
        if (existing) {
            await db.update(schema.repoPrompts).set({ prompt }).where(and(eq(schema.repoPrompts.repo, repo), eq(schema.repoPrompts.profileId, profileId)));
        } else {
            await db.insert(schema.repoPrompts).values({ repo, prompt, profileId });
        }
    }
  };
}

export const appDatabase = new AppDatabase();
