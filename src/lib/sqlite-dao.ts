
import type { Dao } from './dao';
import type { Job, PredefinedPrompt } from './types';
import { getDb } from './database';

export class SqliteDao implements Dao {
  async getJobs(): Promise<Job[]> {
    const db = await getDb();
    const rows = await db.all('SELECT raw_json FROM jobs');
    return rows.map(row => JSON.parse(row.raw_json));
  }

  async addJob(job: Job): Promise<void> {
    const db = await getDb();
    await db.run(
      'INSERT INTO jobs (id, name, repo, branch, created_at, raw_json) VALUES (?, ?, ?, ?, ?, ?)',
      job.id,
      job.name,
      job.repo,
      job.branch,
      job.createdAt,
      JSON.stringify(job)
    );
  }

  async getPredefinedPrompts(): Promise<PredefinedPrompt[]> {
    const db = await getDb();
    return db.all('SELECT id, title, prompt FROM predefined_prompts');
  }

  async savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    const db = await getDb();
    await db.run('DELETE FROM predefined_prompts');
    for (const prompt of prompts) {
      await db.run('INSERT INTO predefined_prompts (id, title, prompt) VALUES (?, ?, ?)', prompt.id, prompt.title, prompt.prompt);
    }
  }

  async getQuickReplies(): Promise<PredefinedPrompt[]> {
    const db = await getDb();
    return db.all('SELECT id, title, prompt FROM quick_replies');
  }

  async saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    const db = await getDb();
    await db.run('DELETE FROM quick_replies');
    for (const reply of replies) {
      await db.run('INSERT INTO quick_replies (id, title, prompt) VALUES (?, ?, ?)', reply.id, reply.title, reply.prompt);
    }
  }

  async getGlobalPrompt(): Promise<string> {
    const db = await getDb();
    const row = await db.get('SELECT prompt FROM global_prompt LIMIT 1');
    return row?.prompt || '';
  }

  async saveGlobalPrompt(prompt: string): Promise<void> {
    const db = await getDb();
    await db.run('DELETE FROM global_prompt');
    await db.run('INSERT INTO global_prompt (prompt) VALUES (?)', prompt);
  }
}
