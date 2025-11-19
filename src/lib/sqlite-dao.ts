
import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import { Dao } from './dao';
import { initializeDatabase } from './db-init';
import type { Job, PredefinedPrompt } from './types';

const DB_PATH = process.env.JULES_DB_PATH || './data/database.db';

class SqliteDao implements Dao {
  private db: Promise<Database>;

  constructor() {
    this.db = initializeDatabase();
  }

  async getJobs(): Promise<Job[]> {
    const db = await this.db;
    const rows = await db.all('SELECT * FROM jobs');
    return rows.map(row => ({
      ...row,
      sessionIds: JSON.parse(row.sessionIds),
    }));
  }

  async addJob(job: Job): Promise<void> {
    const db = await this.db;
    await db.run(
      'INSERT INTO jobs (id, name, sessionIds, createdAt, repo, branch) VALUES (?, ?, ?, ?, ?, ?)',
      [job.id, job.name, JSON.stringify(job.sessionIds), job.createdAt, job.repo, job.branch]
    );
  }

  async getPredefinedPrompts(): Promise<PredefinedPrompt[]> {
    const db = await this.db;
    return db.all('SELECT * FROM predefined_prompts');
  }

  async savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    const db = await this.db;
    await db.run('DELETE FROM predefined_prompts');
    for (const prompt of prompts) {
      await db.run(
        'INSERT INTO predefined_prompts (id, title, prompt) VALUES (?, ?, ?)',
        [prompt.id, prompt.title, prompt.prompt]
      );
    }
  }

  async getQuickReplies(): Promise<PredefinedPrompt[]> {
    const db = await this.db;
    return db.all('SELECT * FROM quick_replies');
  }

  async saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    const db = await this.db;
    await db.run('DELETE FROM quick_replies');
    for (const reply of replies) {
      await db.run(
        'INSERT INTO quick_replies (id, title, prompt) VALUES (?, ?, ?)',
        [reply.id, reply.title, reply.prompt]
      );
    }
  }

  async getGlobalPrompt(): Promise<string> {
    const db = await this.db;
    const row = await db.get('SELECT prompt FROM global_prompt WHERE id = 1');
    return row?.prompt || '';
  }

  async saveGlobalPrompt(prompt: string): Promise<void> {
    const db = await this.db;
    await db.run('UPDATE global_prompt SET prompt = ? WHERE id = 1', [prompt]);
  }
}

export const dao = new SqliteDao();
