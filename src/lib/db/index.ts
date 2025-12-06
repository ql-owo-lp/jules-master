
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

// Helper to get active profile ID
// Note: This must be called inside an async function or where DB access is allowed.
export async function getActiveProfileId(): Promise<string> {
  const profile = await db.select().from(schema.profiles).where(eq(schema.profiles.isActive, true)).get();
  if (profile) return profile.id;

  // Create default profile if none exists
  const count = await db.select({ count:  schema.profiles.id }).from(schema.profiles).get();
  if (!count) {
     const id = crypto.randomUUID();
     await db.insert(schema.profiles).values({
         id,
         name: "Default",
         isActive: true,
         createdAt: new Date().toISOString()
     });
     // Also initialize default settings for this profile
     await db.insert(schema.settings).values({ profileId: id });
     return id;
  }

  // If profiles exist but none active, activate the first one
  const first = await db.select().from(schema.profiles).limit(1).get();
  if (first) {
      await db.update(schema.profiles).set({ isActive: true }).where(eq(schema.profiles.id, first.id));
      return first.id;
  }

  throw new Error("Failed to get active profile");
}


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
      const profileId = await getActiveProfileId();
      const jobs = await db.select().from(schema.jobs).where(eq(schema.jobs.profileId, profileId));
      return jobs.map(job => ({
        ...job,
        sessionIds: job.sessionIds || []
      }));
    },
    getById: async (id) => {
        // We might not need profileId here if ID is UUID, but good practice
        const job = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).get();
        if (job) {
             return { ...job, sessionIds: job.sessionIds || [] };
        }
        return undefined;
    },
    create: async (job) => {
        const profileId = await getActiveProfileId();
        await db.insert(schema.jobs).values({ ...job, profileId })
    },
    createMany: async (jobs) => { 
      if (jobs.length === 0) return;
      const profileId = await getActiveProfileId();
      const jobsWithProfile = jobs.map(j => ({ ...j, profileId }));
      await db.insert(schema.jobs).values(jobsWithProfile);
    },
    update: async (id, job) => { await db.update(schema.jobs).set(job).where(eq(schema.jobs.id, id)) },
    delete: async (id) => { await db.delete(schema.jobs).where(eq(schema.jobs.id, id)) },
  };

  // PredefinedPrompt DAO
  public predefinedPrompts: IDao<PredefinedPrompt> = {
    getAll: async () => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, profileId));
    },
    getById: async (id) => db.select().from(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.id, id)).get(),
    create: async (prompt) => {
        const profileId = await getActiveProfileId();
        await db.insert(schema.predefinedPrompts).values({ ...prompt, profileId })
    },
    createMany: async (prompts) => {
        if (prompts.length === 0) return;
        const profileId = await getActiveProfileId();
        const promptsWithProfile = prompts.map(p => ({ ...p, profileId }));
        await db.insert(schema.predefinedPrompts).values(promptsWithProfile);
    },
    update: async (id, prompt) => { await db.update(schema.predefinedPrompts).set(prompt).where(eq(schema.predefinedPrompts.id, id)) },
    delete: async (id) => { await db.delete(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.id, id)) },
  };

  // HistoryPrompt DAO
  public historyPrompts: IDao<HistoryPrompt> & { getRecent: (limit: number) => Promise<HistoryPrompt[]> } = {
    getAll: async () => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.historyPrompts)
            .where(eq(schema.historyPrompts.profileId, profileId))
            .orderBy(desc(schema.historyPrompts.lastUsedAt));
    },
    getRecent: async (limit) => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.historyPrompts)
            .where(eq(schema.historyPrompts.profileId, profileId))
            .orderBy(desc(schema.historyPrompts.lastUsedAt))
            .limit(limit);
    },
    getById: async (id) => db.select().from(schema.historyPrompts).where(eq(schema.historyPrompts.id, id)).get(),
    create: async (prompt) => {
        const profileId = await getActiveProfileId();
        await db.insert(schema.historyPrompts).values({ ...prompt, profileId });
    },
    createMany: async (prompts) => {
        if (prompts.length === 0) return;
        const profileId = await getActiveProfileId();
        const promptsWithProfile = prompts.map(p => ({ ...p, profileId }));
        await db.insert(schema.historyPrompts).values(promptsWithProfile);
    },
    update: async (id, prompt) => { await db.update(schema.historyPrompts).set(prompt).where(eq(schema.historyPrompts.id, id)) },
    delete: async (id) => { await db.delete(schema.historyPrompts).where(eq(schema.historyPrompts.id, id)) },
  };

  // QuickReply DAO
  public quickReplies: IDao<PredefinedPrompt> = {
    getAll: async () => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.quickReplies).where(eq(schema.quickReplies.profileId, profileId));
    },
    getById: async (id) => db.select().from(schema.quickReplies).where(eq(schema.quickReplies.id, id)).get(),
    create: async (reply) => {
        const profileId = await getActiveProfileId();
        await db.insert(schema.quickReplies).values({ ...reply, profileId });
    },
    createMany: async (replies) => {
        if (replies.length === 0) return;
        const profileId = await getActiveProfileId();
        const repliesWithProfile = replies.map(r => ({ ...r, profileId }));
        await db.insert(schema.quickReplies).values(repliesWithProfile);
    },
    update: async (id, reply) => { await db.update(schema.quickReplies).set(reply).where(eq(schema.quickReplies.id, id)) },
    delete: async (id) => { await db.delete(schema.quickReplies).where(eq(schema.quickReplies.id, id)) },
  };

  // GlobalPrompt DAO
  public globalPrompt = {
    get: async () => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.globalPrompt).where(eq(schema.globalPrompt.profileId, profileId)).get();
    },
    save: async (prompt: string) => {
        const profileId = await getActiveProfileId();
        const existing = await db.select().from(schema.globalPrompt).where(eq(schema.globalPrompt.profileId, profileId)).get();
        if (existing) {
            await db.update(schema.globalPrompt).set({ prompt }).where(eq(schema.globalPrompt.id, existing.id));
        } else {
            await db.insert(schema.globalPrompt).values({ prompt, profileId });
        }
    }
  };

  // RepoPrompts DAO
  public repoPrompts = {
    get: async (repo: string) => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.repoPrompts).where(and(
            eq(schema.repoPrompts.repo, repo),
            eq(schema.repoPrompts.profileId, profileId)
        )).get();
    },
    save: async (repo: string, prompt: string) => {
        const profileId = await getActiveProfileId();
        const existing = await db.select().from(schema.repoPrompts).where(and(
            eq(schema.repoPrompts.repo, repo),
            eq(schema.repoPrompts.profileId, profileId)
        )).get();
        if (existing) {
            await db.update(schema.repoPrompts).set({ prompt }).where(eq(schema.repoPrompts.id, existing.id));
        } else {
            await db.insert(schema.repoPrompts).values({ repo, prompt, profileId });
        }
    }
  };
}

export const appDatabase = new AppDatabase();
