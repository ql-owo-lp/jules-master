
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { Job, PredefinedPrompt } from '../types';
import { eq } from 'drizzle-orm';
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

// Generic DAO Interface
export interface IDao<T> {
  getAll(): Promise<T[]>;
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
    getAll: async () => {
        const jobs = await db.select().from(schema.jobs);
        return jobs.map(j => ({...j, sessionIds: j.sessionIds || []}));
    },
    getById: async (id) => {
        const job = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).get();
        if (job) {
            return {...job, sessionIds: job.sessionIds || []};
        }
        return undefined;
    },
    create: async (job) => { await db.insert(schema.jobs).values({...job, sessionIds: job.sessionIds || []}) },
    createMany: async (jobs) => { 
      if (jobs.length === 0) return;
      const mappedJobs = jobs.map(j => ({...j, sessionIds: j.sessionIds || []}));
      await db.insert(schema.jobs).values(mappedJobs);
    },
    update: async (id, job) => {
        const updateData = {...job};
        if (updateData.sessionIds === undefined) {
            // If not provided, we don't update it (or should we?)
            // partial update usually implies updating provided fields only.
            // But here type check is failing because sessionIds in DB is string[] | null ? No, in schema it is string[].
        }
        await db.update(schema.jobs).set(updateData).where(eq(schema.jobs.id, id))
    },
    delete: async (id) => { await db.delete(schema.jobs).where(eq(schema.jobs.id, id)) },
  };

  // PredefinedPrompt DAO
  public predefinedPrompts: IDao<PredefinedPrompt> = {
    getAll: async () => db.select().from(schema.predefinedPrompts),
    getById: async (id) => db.select().from(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.id, id)).get(),
    create: async (prompt) => { await db.insert(schema.predefinedPrompts).values(prompt) },
    createMany: async (prompts) => {
        if (prompts.length === 0) return;
        await db.insert(schema.predefinedPrompts).values(prompts);
    },
    update: async (id, prompt) => { await db.update(schema.predefinedPrompts).set(prompt).where(eq(schema.predefinedPrompts.id, id)) },
    delete: async (id) => { await db.delete(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.id, id)) },
  };

  // QuickReply DAO
  public quickReplies: IDao<PredefinedPrompt> = {
    getAll: async () => db.select().from(schema.quickReplies),
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
    get: async () => db.select().from(schema.globalPrompt).get(),
    save: async (prompt: string) => {
        const existing = await db.select().from(schema.globalPrompt).get();
        if (existing) {
            await db.update(schema.globalPrompt).set({ prompt }).where(eq(schema.globalPrompt.id, existing.id));
        } else {
            await db.insert(schema.globalPrompt).values({id: 1, prompt: prompt });
        }
    }
  };
}

export const appDatabase = new AppDatabase();
