
import { dao } from './sqlite-dao';
import { initializeDatabase } from './db-init';
import type { Job, PredefinedPrompt } from './types';

jest.mock('./db-init', () => ({
  initializeDatabase: jest.fn().mockResolvedValue({
    exec: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
    get: jest.fn(),
  }),
}));

describe('SqliteDao', () => {
  let db: any;

  beforeEach(async () => {
    db = await initializeDatabase();
    jest.clearAllMocks();
  });

  describe('Jobs', () => {
    it('should get jobs', async () => {
      const mockJobs = [
        { id: '1', name: 'Test Job', sessionIds: '[]', createdAt: '2023-01-01', repo: 'test/repo', branch: 'main' },
      ];
      db.all.mockResolvedValue(mockJobs);

      const jobs = await dao.getJobs();
      expect(db.all).toHaveBeenCalledWith('SELECT * FROM jobs');
      expect(jobs).toEqual([{ ...mockJobs[0], sessionIds: [] }]);
    });

    it('should add a job', async () => {
      const newJob: Job = { id: '2', name: 'New Job', sessionIds: ['a', 'b'], createdAt: '2023-01-02', repo: 'new/repo', branch: 'dev' };
      await dao.addJob(newJob);
      expect(db.run).toHaveBeenCalledWith(
        'INSERT INTO jobs (id, name, sessionIds, createdAt, repo, branch) VALUES (?, ?, ?, ?, ?, ?)',
        [newJob.id, newJob.name, JSON.stringify(newJob.sessionIds), newJob.createdAt, newJob.repo, newJob.branch]
      );
    });
  });

  describe('Predefined Prompts', () => {
    it('should get predefined prompts', async () => {
      const mockPrompts = [{ id: '1', title: 'Test Prompt', prompt: 'Hello' }];
      db.all.mockResolvedValue(mockPrompts);

      const prompts = await dao.getPredefinedPrompts();
      expect(db.all).toHaveBeenCalledWith('SELECT * FROM predefined_prompts');
      expect(prompts).toEqual(mockPrompts);
    });

    it('should save predefined prompts', async () => {
      const prompts: PredefinedPrompt[] = [{ id: '1', title: 'New Prompt', prompt: 'Hi' }];
      await dao.savePredefinedPrompts(prompts);
      expect(db.run).toHaveBeenCalledWith('DELETE FROM predefined_prompts');
      expect(db.run).toHaveBeenCalledWith(
        'INSERT INTO predefined_prompts (id, title, prompt) VALUES (?, ?, ?)',
        [prompts[0].id, prompts[0].title, prompts[0].prompt]
      );
    });
  });

  describe('Quick Replies', () => {
    it('should get quick replies', async () => {
      const mockReplies = [{ id: '1', title: 'Test Reply', prompt: 'Okay' }];
      db.all.mockResolvedValue(mockReplies);

      const replies = await dao.getQuickReplies();
      expect(db.all).toHaveBeenCalledWith('SELECT * FROM quick_replies');
      expect(replies).toEqual(mockReplies);
    });

    it('should save quick replies', async () => {
      const replies: PredefinedPrompt[] = [{ id: '1', title: 'New Reply', prompt: 'Got it' }];
      await dao.saveQuickReplies(replies);
      expect(db.run).toHaveBeenCalledWith('DELETE FROM quick_replies');
      expect(db.run).toHaveBeenCalledWith(
        'INSERT INTO quick_replies (id, title, prompt) VALUES (?, ?, ?)',
        [replies[0].id, replies[0].title, replies[0].prompt]
      );
    });
  });

  describe('Global Prompt', () => {
    it('should get the global prompt', async () => {
      db.get.mockResolvedValue({ prompt: 'Global Prompt' });

      const prompt = await dao.getGlobalPrompt();
      expect(db.get).toHaveBeenCalledWith('SELECT prompt FROM global_prompt WHERE id = 1');
      expect(prompt).toBe('Global Prompt');
    });

    it('should save the global prompt', async () => {
      const newPrompt = 'New Global Prompt';
      await dao.saveGlobalPrompt(newPrompt);
      expect(db.run).toHaveBeenCalledWith('UPDATE global_prompt SET prompt = ? WHERE id = 1', [newPrompt]);
    });
  });
});
