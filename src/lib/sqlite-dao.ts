
import { Dao } from './dao';
import db from './db';
import type { Job, PredefinedPrompt } from './types';
import { v4 as uuidv4 } from 'uuid';

class SqliteDao implements Dao {
  async getJobs(): Promise<Job[]> {
    const stmt = db.prepare('SELECT * FROM jobs');
    const jobs = stmt.all() as Job[];
    return jobs;
  }

  async addJob(job: Job): Promise<void> {
    const stmt = db.prepare(
      'INSERT INTO jobs (id, name, prompt, model, temperature, frequency_penalty, presence_penalty) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    stmt.run(
      job.id || uuidv4(),
      job.name,
      job.prompt,
      job.model,
      job.temperature,
      job.frequency_penalty,
      job.presence_penalty
    );
  }

  async getPredefinedPrompts(): Promise<PredefinedPrompt[]> {
    const stmt = db.prepare('SELECT * FROM predefined_prompts');
    const prompts = stmt.all() as PredefinedPrompt[];
    return prompts;
  }

  async savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    const deleteStmt = db.prepare('DELETE FROM predefined_prompts');
    const insertStmt = db.prepare('INSERT INTO predefined_prompts (id, name, prompt) VALUES (?, ?, ?)');

    const transaction = db.transaction(() => {
      deleteStmt.run();
      for (const prompt of prompts) {
        insertStmt.run(prompt.id || uuidv4(), prompt.name, prompt.prompt);
      }
    });
    transaction();
  }

  async getQuickReplies(): Promise<PredefinedPrompt[]> {
    const stmt = db.prepare('SELECT * FROM quick_replies');
    const replies = stmt.all() as PredefinedPrompt[];
    return replies;
  }

  async saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    const deleteStmt = db.prepare('DELETE FROM quick_replies');
    const insertStmt = db.prepare('INSERT INTO quick_replies (id, name, prompt) VALUES (?, ?, ?)');

    const transaction = db.transaction(() => {
      deleteStmt.run();
      for (const reply of replies) {
        insertStmt.run(reply.id || uuidv4(), reply.name, reply.prompt);
      }
    });
    transaction();
  }

  async getGlobalPrompt(): Promise<string> {
    const stmt = db.prepare("SELECT value FROM global_settings WHERE key = 'globalPrompt'");
    const result = stmt.get() as { value: string } | undefined;
    return result?.value || '';
  }

  async saveGlobalPrompt(prompt: string): Promise<void> {
    const stmt = db.prepare("UPDATE global_settings SET value = ? WHERE key = 'globalPrompt'");
    stmt.run(prompt);
  }
}

export const dao = new SqliteDao();
