
import { dao } from './sqlite-dao';
import db from './db';
import type { Job, PredefinedPrompt } from './types';
import { v4 as uuidv4 } from 'uuid';

jest.mock('./db', () => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  const schema = `
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      model TEXT,
      temperature REAL,
      frequency_penalty REAL,
      presence_penalty REAL
    );

    CREATE TABLE IF NOT EXISTS predefined_prompts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quick_replies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS global_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `;
  db.exec(schema);
  const stmt = db.prepare('INSERT OR IGNORE INTO global_settings (key, value) VALUES (?, ?)');
  stmt.run('globalPrompt', '');
  return db;
});

describe('SqliteDao', () => {
  afterEach(() => {
    db.exec('DELETE FROM jobs');
    db.exec('DELETE FROM predefined_prompts');
    db.exec('DELETE FROM quick_replies');
    db.exec("UPDATE global_settings SET value = '' WHERE key = 'globalPrompt'");
  });

  describe('Jobs', () => {
    it('should add and get jobs', async () => {
      const newJob: Job = {
        id: uuidv4(),
        name: 'Test Job',
        prompt: 'Test Prompt',
        model: 'test-model',
        temperature: 0.5,
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
      };

      await dao.addJob(newJob);
      const jobs = await dao.getJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toEqual(newJob);
    });
  });

  describe('Predefined Prompts', () => {
    it('should save and get predefined prompts', async () => {
      const prompts: PredefinedPrompt[] = [
        { id: uuidv4(), name: 'Prompt 1', prompt: 'Prompt 1 text' },
        { id: uuidv4(), name: 'Prompt 2', prompt: 'Prompt 2 text' },
      ];

      await dao.savePredefinedPrompts(prompts);
      const savedPrompts = await dao.getPredefinedPrompts();

      expect(savedPrompts).toHaveLength(2);
      expect(savedPrompts).toEqual(expect.arrayContaining(prompts));
    });

    it('should handle deletions when saving predefined prompts', async () => {
        const initialPrompts: PredefinedPrompt[] = [
            { id: uuidv4(), name: 'Prompt 1', prompt: 'Prompt 1 text' },
            { id: uuidv4(), name: 'Prompt 2', prompt: 'Prompt 2 text' },
        ];
        await dao.savePredefinedPrompts(initialPrompts);

        const newPrompts: PredefinedPrompt[] = [
            { id: initialPrompts[0].id, name: 'Prompt 1 Updated', prompt: 'Prompt 1 Updated text' },
        ];
        await dao.savePredefinedPrompts(newPrompts);

        const savedPrompts = await dao.getPredefinedPrompts();
        expect(savedPrompts).toHaveLength(1);
        expect(savedPrompts[0].name).toBe('Prompt 1 Updated');
    });
  });

  describe('Quick Replies', () => {
    it('should save and get quick replies', async () => {
        const replies: PredefinedPrompt[] = [
            { id: uuidv4(), name: 'Reply 1', prompt: 'Reply 1 text' },
            { id: uuidv4(), name: 'Reply 2', prompt: 'Reply 2 text' },
        ];

        await dao.saveQuickReplies(replies);
        const savedReplies = await dao.getQuickReplies();

        expect(savedReplies).toHaveLength(2);
        expect(savedReplies).toEqual(expect.arrayContaining(replies));
    });

    it('should handle deletions when saving quick replies', async () => {
        const initialReplies: PredefinedPrompt[] = [
            { id: uuidv4(), name: 'Reply 1', prompt: 'Reply 1 text' },
            { id: uuidv4(), name: 'Reply 2', prompt: 'Reply 2 text' },
        ];
        await dao.saveQuickReplies(initialReplies);

        const newReplies: PredefinedPrompt[] = [
            { id: initialReplies[0].id, name: 'Reply 1 Updated', prompt: 'Reply 1 Updated text' },
        ];
        await dao.saveQuickReplies(newReplies);

        const savedReplies = await dao.getQuickReplies();
        expect(savedReplies).toHaveLength(1);
        expect(savedReplies[0].name).toBe('Reply 1 Updated');
    });
  });

  describe('Global Prompt', () => {
    it('should save and get the global prompt', async () => {
      const newPrompt = 'This is a new global prompt';
      await dao.saveGlobalPrompt(newPrompt);
      const prompt = await dao.getGlobalPrompt();

      expect(prompt).toBe(newPrompt);
    });
  });
});
