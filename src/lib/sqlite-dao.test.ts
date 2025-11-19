
import { dao } from './sqlite-dao';
import { getDb } from './db';
import type { Job, PredefinedPrompt } from './types';
import { randomUUID } from 'crypto';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { Database } from 'sqlite';

let db: Database;

beforeAll(async () => {
    db = await open({
        filename: ':memory:',
        driver: sqlite3.Database,
    });
    await db.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            name TEXT,
            session_ids TEXT,
            created_at TEXT,
            repo TEXT,
            branch TEXT
        );
        CREATE TABLE IF NOT EXISTS predefined_prompts (
            id TEXT PRIMARY KEY,
            title TEXT,
            prompt TEXT
        );
        CREATE TABLE IF NOT EXISTS quick_replies (
            id TEXT PRIMARY KEY,
            title TEXT,
            prompt TEXT
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);
    (getDb as jest.Mock).mockResolvedValue(db);
});

afterAll(async () => {
    await db.close();
});

// Mock the getDb function to use an in-memory database for testing
jest.mock('./db', () => ({
    getDb: jest.fn(),
}));

describe('SqliteDao', () => {
    beforeEach(async () => {
        await db.exec('DELETE FROM jobs');
        await db.exec('DELETE FROM predefined_prompts');
        await db.exec('DELETE FROM quick_replies');
        await db.exec('DELETE FROM settings');
    });

    describe('Jobs', () => {
        it('should add and get jobs', async () => {
            const newJob: Job = {
                id: randomUUID(),
                name: 'Test Job',
                sessionIds: [randomUUID()],
                createdAt: new Date().toISOString(),
                repo: 'test/repo',
                branch: 'main',
            };
            await dao.addJob(newJob);
            const jobs = await dao.getJobs();
            expect(jobs).toHaveLength(1);
            expect(jobs[0]).toEqual(newJob);
        });
    });

    describe('Predefined Prompts', () => {
        it('should save and get predefined prompts', async () => {
            const newPrompts: PredefinedPrompt[] = [
                {
                    id: randomUUID(),
                    title: 'Test Prompt',
                    prompt: 'This is a test prompt.',
                },
            ];
            await dao.savePredefinedPrompts(newPrompts);
            const prompts = await dao.getPredefinedPrompts();
            expect(prompts).toHaveLength(1);
            expect(prompts[0]).toEqual(newPrompts[0]);
        });
    });

    describe('Quick Replies', () => {
        it('should save and get quick replies', async () => {
            const newReplies: PredefinedPrompt[] = [
                {
                    id: randomUUID(),
                    title: 'Test Reply',
                    prompt: 'This is a test reply.',
                },
            ];
            await dao.saveQuickReplies(newReplies);
            const replies = await dao.getQuickReplies();
            expect(replies).toHaveLength(1);
            expect(replies[0]).toEqual(newReplies[0]);
        });
    });

    describe('Global Prompt', () => {
        it('should save and get the global prompt', async () => {
            const newPrompt = 'This is a test global prompt.';
            await dao.saveGlobalPrompt(newPrompt);
            const prompt = await dao.getGlobalPrompt();
            expect(prompt).toEqual(newPrompt);
        });
    });
});
