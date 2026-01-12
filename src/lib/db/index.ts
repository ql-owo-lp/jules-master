
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { Job, PredefinedPrompt, HistoryPrompt } from '../types';
import { eq, desc } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import path from 'path';

// Resolve database path (handle relative paths in DATABASE_URL or default)
const isTest = process.env.NODE_ENV === 'test';
// Force memory for build/test to avoid file I/O issues and side effects
const isBuild = !!process.env.IS_BUILD;
const dbUrl = isBuild || isTest ? ':memory:' : (process.env.DATABASE_URL || 'data/sqlite.db');

let dbPath = dbUrl;
if (dbUrl !== ':memory:') {
  dbPath = path.isAbsolute(dbUrl) ? dbUrl : path.join(process.cwd(), dbUrl);
}

let sqlite: any;
try {
  sqlite = new Database(dbPath);
} catch (error) {
  // If build, maybe we can survive with a mock?
  if (isBuild) {
      console.warn('Failed to load sqlite database during build, using mock:', error);
      sqlite = {
          exec: () => {},
          prepare: () => ({ get: () => null, all: () => [], run: () => {} }),
          transaction: (fn: any) => fn,
      };
  } else {
      throw error;
  }
}

const migrationsDir = path.join(process.cwd(), 'src/lib/db/migrations');

if (isBuild && dbUrl === ':memory:') {
  if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
          sqlite.exec(sql);
      }
  }
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
      return jobs.map(job => {
        // Drizzle handles JSON parsing for sessionIds automatically with mode: 'json'
        return {
            ...job,
            sessionIds: job.sessionIds || []
        } as Job;
      });
    },
    getById: async (id) => {
        const job = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).get();
        if (job) {
             return { ...job, sessionIds: job.sessionIds || [] } as Job;
        }
        return undefined;
    },
    create: async (job) => { await db.insert(schema.jobs).values(job as any) },
    createMany: async (jobs) => { 
      if (jobs.length === 0) return;
      await db.insert(schema.jobs).values(jobs as any);
    },
    update: async (id, job) => { await db.update(schema.jobs).set(job as any).where(eq(schema.jobs.id, id)) },
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

  // HistoryPrompt DAO
  public historyPrompts: IDao<HistoryPrompt> & { getRecent: (limit: number) => Promise<HistoryPrompt[]> } = {
    getAll: async () => db.select().from(schema.historyPrompts).orderBy(desc(schema.historyPrompts.lastUsedAt)),
    getRecent: async (limit) => db.select().from(schema.historyPrompts).orderBy(desc(schema.historyPrompts.lastUsedAt)).limit(limit),
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

  // RepoPrompts DAO
  public repoPrompts = {
    get: async (repo: string) => db.select().from(schema.repoPrompts).where(eq(schema.repoPrompts.repo, repo)).get(),
    save: async (repo: string, prompt: string) => {
        const existing = await db.select().from(schema.repoPrompts).where(eq(schema.repoPrompts.repo, repo)).get();
        if (existing) {
            await db.update(schema.repoPrompts).set({ prompt }).where(eq(schema.repoPrompts.repo, repo));
        } else {
            await db.insert(schema.repoPrompts).values({ repo, prompt });
        }
    }
  };
}

export const appDatabase = new AppDatabase();
