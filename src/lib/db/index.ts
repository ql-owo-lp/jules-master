
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { Job, PredefinedPrompt } from '../types';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import path from 'path';

// Resolve database path
let dbPath = process.env.DATABASE_URL || 'data/sqlite.db';

// Handle potential file:// prefix which better-sqlite3 doesn't like but might be passed
if (dbPath.startsWith('file://')) {
    dbPath = dbPath.slice(7);
} else if (dbPath.startsWith('file:')) {
    dbPath = dbPath.slice(5);
}

// If path is relative, resolve it relative to CWD
if (!path.isAbsolute(dbPath)) {
    dbPath = path.resolve(process.cwd(), dbPath);
}

const dbDir = path.dirname(dbPath);

// Ensure the directory exists and is writable
try {
    if (!fs.existsSync(dbDir)) {
        console.log(`Creating database directory: ${dbDir}`);
        fs.mkdirSync(dbDir, { recursive: true });
    }

    // Check if directory is writable
    try {
        fs.accessSync(dbDir, fs.constants.W_OK);
    } catch (err) {
        console.error(`Database directory ${dbDir} is not writable!`, err);
        // Depending on strictness, we might want to throw here or let Database() fail
    }

} catch (e) {
    console.error(`Failed to prepare database directory ${dbDir}:`, e);
}

let sqlite: Database.Database;
try {
    console.log(`Initializing database at path: ${dbPath}`);
    sqlite = new Database(dbPath);
} catch (e) {
    console.error(`Failed to initialize database at ${dbPath}.`);
    console.error(`Directory exists: ${fs.existsSync(dbDir)}`);
    try {
        const stats = fs.statSync(dbDir);
        console.error(`Directory permissions: ${stats.mode.toString(8)}`);
        console.error(`Directory owner: ${stats.uid}:${stats.gid}`);
        console.error(`Process user: ${process.getuid?.()}:${process.getgid?.()}`);
    } catch (statErr) {
        console.error("Could not stat directory:", statErr);
    }
    throw e;
}

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
        return jobs.map(j => ({
            ...j,
            sessionIds: j.sessionIds ?? []
        }));
    },
    getById: async (id) => {
        const job = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).get();
        if (!job) return undefined;
        return {
            ...job,
            sessionIds: job.sessionIds ?? []
        };
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
