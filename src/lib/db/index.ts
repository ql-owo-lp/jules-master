
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { Job, PredefinedPrompt, HistoryPrompt } from '../types';
import { eq, desc, and } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import path from 'path';
import { profileService } from './profile-service';

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

// Initialize default profile if needed
profileService.ensureDefaultProfile().catch(console.error);

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
             // @ts-ignore
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
    getAll: async (profileId?: string) => {
        if (profileId) {
            return db.select().from(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, profileId));
        }
        return db.select().from(schema.predefinedPrompts);
    },
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
  public historyPrompts: IDao<HistoryPrompt> & { getRecent: (limit: number, profileId?: string) => Promise<HistoryPrompt[]> } = {
    getAll: async (profileId?: string) => {
        if (profileId) {
            return db.select().from(schema.historyPrompts).where(eq(schema.historyPrompts.profileId, profileId)).orderBy(desc(schema.historyPrompts.lastUsedAt));
        }
        return db.select().from(schema.historyPrompts).orderBy(desc(schema.historyPrompts.lastUsedAt));
    },
    getRecent: async (limit, profileId?: string) => {
        if (profileId) {
             return db.select().from(schema.historyPrompts).where(eq(schema.historyPrompts.profileId, profileId)).orderBy(desc(schema.historyPrompts.lastUsedAt)).limit(limit);
        }
        return db.select().from(schema.historyPrompts).orderBy(desc(schema.historyPrompts.lastUsedAt)).limit(limit);
    },
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
    getAll: async (profileId?: string) => {
        if (profileId) {
            return db.select().from(schema.quickReplies).where(eq(schema.quickReplies.profileId, profileId));
        }
        return db.select().from(schema.quickReplies);
    },
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
    get: async (profileId?: string) => {
        if (profileId) {
            return db.select().from(schema.globalPrompt).where(eq(schema.globalPrompt.profileId, profileId)).get();
        }
        return db.select().from(schema.globalPrompt).get();
    },
    save: async (prompt: string, profileId: string) => {
        const existing = await db.select().from(schema.globalPrompt).where(eq(schema.globalPrompt.profileId, profileId)).get();
        if (existing) {
            await db.update(schema.globalPrompt).set({ prompt }).where(eq(schema.globalPrompt.id, existing.id));
        } else {
             // For simplicity, we use a random ID or rely on auto-increment if we change the schema.
             // But the schema defined id as integer primary key.
             // Let's check the schema again.
             // It is `id: integer('id').primaryKey()`. SQLite handles auto-increment for integer primary keys.
             // But `profileId` is also needed.
             // We need to check if we can insert without ID.
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
            await db.update(schema.repoPrompts).set({ prompt }).where(eq(schema.repoPrompts.id, existing.id));
        } else {
            await db.insert(schema.repoPrompts).values({ id: crypto.randomUUID(), repo, prompt, profileId });
        }
    }
  };
}

export const appDatabase = new AppDatabase();
