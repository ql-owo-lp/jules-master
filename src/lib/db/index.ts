
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { Job, PredefinedPrompt, HistoryPrompt } from '../types';
import { eq, desc, and } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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

export async function getActiveProfileId(): Promise<string> {
    const activeProfile = await db.select().from(schema.profiles).where(eq(schema.profiles.isActive, true)).limit(1);
    if (activeProfile.length === 0) {
        // Fallback to finding "Default" or just any profile
        const anyProfile = await db.select().from(schema.profiles).limit(1);
        if (anyProfile.length > 0) return anyProfile[0].id;
        throw new Error("No profiles found!");
    }
    return activeProfile[0].id;
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
  public jobs: IDao<Job> & { getPendingWorkCount: () => Promise<{ pendingJobs: number, retryingSessions: number }> } = {
    getAll: async () => {
      const profileId = await getActiveProfileId();
      const jobs = await db.select().from(schema.jobs).where(eq(schema.jobs.profileId, profileId));
      return jobs.map(job => ({
        ...job,
        sessionIds: job.sessionIds || []
      }));
    },
    getById: async (id) => {
        // We might not need to filter by profileId here if ID is UUID, but it's safer.
        const profileId = await getActiveProfileId();
        const job = await db.select().from(schema.jobs).where(and(eq(schema.jobs.id, id), eq(schema.jobs.profileId, profileId))).get();
        if (job) {
             return { ...job, sessionIds: job.sessionIds || [] };
        }
        return undefined;
    },
    create: async (job) => {
        const profileId = await getActiveProfileId();
        await db.insert(schema.jobs).values({ ...job, profileId });
    },
    createMany: async (jobs) => { 
      if (jobs.length === 0) return;
      const profileId = await getActiveProfileId();
      await db.insert(schema.jobs).values(jobs.map(j => ({ ...j, profileId })));
    },
    update: async (id, job) => {
        const profileId = await getActiveProfileId();
        await db.update(schema.jobs).set(job).where(and(eq(schema.jobs.id, id), eq(schema.jobs.profileId, profileId)))
    },
    delete: async (id) => {
        const profileId = await getActiveProfileId();
        await db.delete(schema.jobs).where(and(eq(schema.jobs.id, id), eq(schema.jobs.profileId, profileId)))
    },
    getPendingWorkCount: async () => {
        const profileId = await getActiveProfileId();
        const pendingJobs = await db.select().from(schema.jobs).where(and(eq(schema.jobs.status, 'PENDING'), eq(schema.jobs.profileId, profileId)));

        const failedSessions = await db.select().from(schema.sessions).where(and(eq(schema.sessions.state, 'FAILED'), eq(schema.sessions.profileId, profileId)));
        let retryingSessionsCount = 0;

        for (const session of failedSessions) {
            const errorReason = session.lastError || "";
            const isRateLimit = errorReason.toLowerCase().includes("too many requests") || errorReason.includes("429");
            const maxRetries = isRateLimit ? 50 : 3;
            if ((session.retryCount || 0) < maxRetries) {
                retryingSessionsCount++;
            }
        }

        return {
            pendingJobs: pendingJobs.length,
            retryingSessions: retryingSessionsCount
        };
    }
  };

  // PredefinedPrompt DAO
  public predefinedPrompts: IDao<PredefinedPrompt> = {
    getAll: async () => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.predefinedPrompts).where(eq(schema.predefinedPrompts.profileId, profileId));
    },
    getById: async (id) => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.predefinedPrompts).where(and(eq(schema.predefinedPrompts.id, id), eq(schema.predefinedPrompts.profileId, profileId))).get();
    },
    create: async (prompt) => {
        const profileId = await getActiveProfileId();
        await db.insert(schema.predefinedPrompts).values({ ...prompt, profileId });
    },
    createMany: async (prompts) => {
        if (prompts.length === 0) return;
        const profileId = await getActiveProfileId();
        await db.insert(schema.predefinedPrompts).values(prompts.map(p => ({ ...p, profileId })));
    },
    update: async (id, prompt) => {
        const profileId = await getActiveProfileId();
        await db.update(schema.predefinedPrompts).set(prompt).where(and(eq(schema.predefinedPrompts.id, id), eq(schema.predefinedPrompts.profileId, profileId)));
    },
    delete: async (id) => {
        const profileId = await getActiveProfileId();
        await db.delete(schema.predefinedPrompts).where(and(eq(schema.predefinedPrompts.id, id), eq(schema.predefinedPrompts.profileId, profileId)));
    },
  };

  // HistoryPrompt DAO
  public historyPrompts: IDao<HistoryPrompt> & { getRecent: (limit: number) => Promise<HistoryPrompt[]> } = {
    getAll: async () => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.historyPrompts).where(eq(schema.historyPrompts.profileId, profileId)).orderBy(desc(schema.historyPrompts.lastUsedAt));
    },
    getRecent: async (limit) => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.historyPrompts).where(eq(schema.historyPrompts.profileId, profileId)).orderBy(desc(schema.historyPrompts.lastUsedAt)).limit(limit);
    },
    getById: async (id) => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.historyPrompts).where(and(eq(schema.historyPrompts.id, id), eq(schema.historyPrompts.profileId, profileId))).get();
    },
    create: async (prompt) => {
        const profileId = await getActiveProfileId();
        await db.insert(schema.historyPrompts).values({ ...prompt, profileId });
    },
    createMany: async (prompts) => {
        if (prompts.length === 0) return;
        const profileId = await getActiveProfileId();
        await db.insert(schema.historyPrompts).values(prompts.map(p => ({ ...p, profileId })));
    },
    update: async (id, prompt) => {
        const profileId = await getActiveProfileId();
        await db.update(schema.historyPrompts).set(prompt).where(and(eq(schema.historyPrompts.id, id), eq(schema.historyPrompts.profileId, profileId)));
    },
    delete: async (id) => {
        const profileId = await getActiveProfileId();
        await db.delete(schema.historyPrompts).where(and(eq(schema.historyPrompts.id, id), eq(schema.historyPrompts.profileId, profileId)));
    },
  };

  // QuickReply DAO
  public quickReplies: IDao<PredefinedPrompt> = {
    getAll: async () => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.quickReplies).where(eq(schema.quickReplies.profileId, profileId));
    },
    getById: async (id) => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.quickReplies).where(and(eq(schema.quickReplies.id, id), eq(schema.quickReplies.profileId, profileId))).get();
    },
    create: async (reply) => {
        const profileId = await getActiveProfileId();
        await db.insert(schema.quickReplies).values({ ...reply, profileId });
    },
    createMany: async (replies) => {
        if (replies.length === 0) return;
        const profileId = await getActiveProfileId();
        await db.insert(schema.quickReplies).values(replies.map(r => ({ ...r, profileId })));
    },
    update: async (id, reply) => {
        const profileId = await getActiveProfileId();
        await db.update(schema.quickReplies).set(reply).where(and(eq(schema.quickReplies.id, id), eq(schema.quickReplies.profileId, profileId)));
    },
    delete: async (id) => {
        const profileId = await getActiveProfileId();
        await db.delete(schema.quickReplies).where(and(eq(schema.quickReplies.id, id), eq(schema.quickReplies.profileId, profileId)));
    },
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
            await db.insert(schema.globalPrompt).values({ prompt: prompt, profileId });
        }
    }
  };

  // RepoPrompts DAO
  public repoPrompts = {
    get: async (repo: string) => {
        const profileId = await getActiveProfileId();
        return db.select().from(schema.repoPrompts).where(and(eq(schema.repoPrompts.repo, repo), eq(schema.repoPrompts.profileId, profileId))).get();
    },
    save: async (repo: string, prompt: string) => {
        const profileId = await getActiveProfileId();
        const existing = await db.select().from(schema.repoPrompts).where(and(eq(schema.repoPrompts.repo, repo), eq(schema.repoPrompts.profileId, profileId))).get();
        if (existing) {
            await db.update(schema.repoPrompts).set({ prompt }).where(eq(schema.repoPrompts.id, existing.id));
        } else {
            await db.insert(schema.repoPrompts).values({ id: uuidv4(), repo, prompt, profileId });
        }
    }
  };
}

export const appDatabase = new AppDatabase();
