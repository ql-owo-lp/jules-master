
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

// Generic DAO Interface
export interface IDao<T> {
  getAll(profileId?: string): Promise<T[]>;
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
    getAll: async (profileId?: string) => {
      let query = db.select().from(schema.jobs);
      if (profileId) {
          query = query.where(eq(schema.jobs.profileId, profileId));
      }
      const jobs = await query;
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
    create: async (job) => { db.insert(schema.jobs).values(job).run() },
    createMany: async (jobs) => { 
      if (jobs.length === 0) return;
      db.insert(schema.jobs).values(jobs).run();
    },
    update: async (id, job) => { db.update(schema.jobs).set(job).where(eq(schema.jobs.id, id)).run() },
    delete: async (id) => { db.delete(schema.jobs).where(eq(schema.jobs.id, id)).run() },
  };

  // PredefinedPrompt DAO
  public predefinedPrompts: IDao<PredefinedPrompt> = {
    getAll: async (profileId?: string) => {
        if (profileId) {
            return db.select().from(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, profileId));
        }
        return db.select().from(schema.predefinedPrompts);
    },
    getById: async (id) => db.select().from(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.id, id)).get(),
    create: async (prompt) => { db.insert(schema.predefinedPrompts).values(prompt).run() },
    createMany: async (prompts) => {
        if (prompts.length === 0) return;
        db.insert(schema.predefinedPrompts).values(prompts).run();
    },
    update: async (id, prompt) => { db.update(schema.predefinedPrompts).set(prompt).where(eq(schema.predefinedPrompts.id, id)).run() },
    delete: async (id) => { db.delete(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.id, id)).run() },
  };

  // HistoryPrompt DAO
  public historyPrompts: IDao<HistoryPrompt> & { getRecent: (limit: number, profileId?: string) => Promise<HistoryPrompt[]> } = {
    getAll: async (profileId?: string) => {
        let query = db.select().from(schema.historyPrompts).orderBy(desc(schema.historyPrompts.lastUsedAt));
        if (profileId) query = query.where(eq(schema.historyPrompts.profileId, profileId));
        return query;
    },
    getRecent: async (limit, profileId) => {
        let query = db.select().from(schema.historyPrompts).orderBy(desc(schema.historyPrompts.lastUsedAt));
        if (profileId) query = query.where(eq(schema.historyPrompts.profileId, profileId));
        return query.limit(limit);
    },
    getById: async (id) => db.select().from(schema.historyPrompts).where(eq(schema.historyPrompts.id, id)).get(),
    create: async (prompt) => { db.insert(schema.historyPrompts).values(prompt).run() },
    createMany: async (prompts) => {
        if (prompts.length === 0) return;
        db.insert(schema.historyPrompts).values(prompts).run();
    },
    update: async (id, prompt) => { db.update(schema.historyPrompts).set(prompt).where(eq(schema.historyPrompts.id, id)).run() },
    delete: async (id) => { db.delete(schema.historyPrompts).where(eq(schema.historyPrompts.id, id)).run() },
  };

  // QuickReply DAO
  public quickReplies: IDao<PredefinedPrompt> = {
    getAll: async (profileId?: string) => {
        if (profileId) {
            return db.select().from(schema.quickReplies).where(eq(schema.quickReplies.profileId, profileId));
        }
        return db.select().from(schema.quickReplies);
    },
    getById: async (id) => db.select().from(schema.quickReplies).where(eq(schema.quickReplies.id, id)).get(),
    create: async (reply) => { db.insert(schema.quickReplies).values(reply).run() },
    createMany: async (replies) => {
        if (replies.length === 0) return;
        db.insert(schema.quickReplies).values(replies).run();
    },
    update: async (id, reply) => { db.update(schema.quickReplies).set(reply).where(eq(schema.quickReplies.id, id)).run() },
    delete: async (id) => { db.delete(schema.quickReplies).where(eq(schema.quickReplies.id, id)).run() },
  };

  // GlobalPrompt DAO
  public globalPrompt = {
    get: async (profileId?: string) => {
        if (!profileId) return undefined;
        return db.select().from(schema.globalPrompt).where(eq(schema.globalPrompt.profileId, profileId)).get();
    },
    save: async (profileId: string, prompt: string) => {
        const existing = await db.select().from(schema.globalPrompt).where(eq(schema.globalPrompt.profileId, profileId)).get();
        if (existing) {
            await db.update(schema.globalPrompt).set({ prompt }).where(eq(schema.globalPrompt.profileId, profileId));
        } else {
            // we don't care about ID much, let sqlite handle it
            await db.insert(schema.globalPrompt).values({ profileId, prompt });
        }
    }
  };

  // RepoPrompts DAO
  public repoPrompts = {
    get: async (repo: string, profileId?: string) => {
        if (!profileId) return undefined;
        return db.select().from(schema.repoPrompts).where(and(eq(schema.repoPrompts.repo, repo), eq(schema.repoPrompts.profileId, profileId))).get();
    },
    save: async (repo: string, profileId: string, prompt: string) => {
        const existing = await db.select().from(schema.repoPrompts).where(and(eq(schema.repoPrompts.repo, repo), eq(schema.repoPrompts.profileId, profileId))).get();
        if (existing) {
            await db.update(schema.repoPrompts).set({ prompt }).where(and(eq(schema.repoPrompts.repo, repo), eq(schema.repoPrompts.profileId, profileId)));
        } else {
            await db.insert(schema.repoPrompts).values({ repo, profileId, prompt });
        }
    }
  };
}

export const appDatabase = new AppDatabase();
