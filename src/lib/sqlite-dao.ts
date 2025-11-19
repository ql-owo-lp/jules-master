
import { randomUUID } from 'crypto';
import { getDb } from './db';
import type { Dao } from './dao';
import type { Job, PredefinedPrompt } from './types';

class SqliteDao implements Dao {
    async getJobs(): Promise<Job[]> {
        const db = await getDb();
        const rows = await db.all('SELECT * FROM jobs');
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            sessionIds: row.session_ids ? row.session_ids.split(',') : [],
            createdAt: row.created_at,
            repo: row.repo,
            branch: row.branch,
        }));
    }

    async addJob(job: Job): Promise<void> {
        const db = await getDb();
        await db.run(
            'INSERT INTO jobs (id, name, session_ids, created_at, repo, branch) VALUES (?, ?, ?, ?, ?, ?)',
            job.id,
            job.name,
            job.sessionIds.join(','),
            job.createdAt,
            job.repo,
            job.branch
        );
    }

    async getPredefinedPrompts(): Promise<PredefinedPrompt[]> {
        const db = await getDb();
        const rows = await db.all('SELECT * FROM predefined_prompts');
        return rows.map(row => ({
            id: row.id,
            title: row.title,
            prompt: row.prompt,
        }));
    }

    async savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
        const db = await getDb();
        await db.run('DELETE FROM predefined_prompts');
        for (const prompt of prompts) {
            await db.run(
                'INSERT INTO predefined_prompts (id, title, prompt) VALUES (?, ?, ?)',
                prompt.id || randomUUID(),
                prompt.title,
                prompt.prompt
            );
        }
    }

    async getQuickReplies(): Promise<PredefinedPrompt[]> {
        const db = await getDb();
        const rows = await db.all('SELECT * FROM quick_replies');
        return rows.map(row => ({
            id: row.id,
            title: row.title,
            prompt: row.prompt,
        }));
    }

    async saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
        const db = await getDb();
        await db.run('DELETE FROM quick_replies');
        for (const reply of replies) {
            await db.run(
                'INSERT INTO quick_replies (id, title, prompt) VALUES (?, ?, ?)',
                reply.id || randomUUID(),
                reply.title,
                reply.prompt
            );
        }
    }

    async getGlobalPrompt(): Promise<string> {
        const db = await getDb();
        const row = await db.get('SELECT value FROM settings WHERE key = ?', 'globalPrompt');
        return row?.value || '';
    }

    async saveGlobalPrompt(prompt: string): Promise<void> {
        const db = await getDb();
        await db.run(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            'globalPrompt',
            prompt
        );
    }
}

export const dao = new SqliteDao();
