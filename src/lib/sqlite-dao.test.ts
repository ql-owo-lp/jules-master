
import { SqliteDao } from './sqlite-dao';
import { getDb } from './database';
import type { Job, PredefinedPrompt } from './types';

jest.mock('./database');

const mockDb = {
  all: jest.fn(),
  run: jest.fn(),
  get: jest.fn(),
};

(getDb as jest.Mock).mockResolvedValue(mockDb);

describe('SqliteDao', () => {
  let dao: SqliteDao;

  beforeEach(() => {
    dao = new SqliteDao();
    jest.clearAllMocks();
  });

  it('should get jobs', async () => {
    const mockJobs: Job[] = [{ id: '1', name: 'Test Job', repo: 'test/repo', branch: 'main', createdAt: '2024-01-01', sessionIds: [] }];
    mockDb.all.mockResolvedValue(mockJobs.map(j => ({ raw_json: JSON.stringify(j) })));
    const jobs = await dao.getJobs();
    expect(jobs).toEqual(mockJobs);
    expect(mockDb.all).toHaveBeenCalledWith('SELECT raw_json FROM jobs');
  });

  it('should add a job', async () => {
    const newJob: Job = { id: '2', name: 'New Job', repo: 'new/repo', branch: 'dev', createdAt: '2024-01-02', sessionIds: [] };
    await dao.addJob(newJob);
    expect(mockDb.run).toHaveBeenCalledWith(
      'INSERT INTO jobs (id, name, repo, branch, created_at, raw_json) VALUES (?, ?, ?, ?, ?, ?)',
      newJob.id,
      newJob.name,
      newJob.repo,
      newJob.branch,
      newJob.createdAt,
      JSON.stringify(newJob)
    );
  });

  it('should get predefined prompts', async () => {
    const mockPrompts: PredefinedPrompt[] = [{ id: '1', title: 'Test Prompt', prompt: 'Hello' }];
    mockDb.all.mockResolvedValue(mockPrompts);
    const prompts = await dao.getPredefinedPrompts();
    expect(prompts).toEqual(mockPrompts);
    expect(mockDb.all).toHaveBeenCalledWith('SELECT id, title, prompt FROM predefined_prompts');
  });

  it('should save predefined prompts', async () => {
    const promptsToSave: PredefinedPrompt[] = [{ id: '2', title: 'New Prompt', prompt: 'World' }];
    await dao.savePredefinedPrompts(promptsToSave);
    expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM predefined_prompts');
    expect(mockDb.run).toHaveBeenCalledWith(
      'INSERT INTO predefined_prompts (id, title, prompt) VALUES (?, ?, ?)',
      promptsToSave[0].id,
      promptsToSave[0].title,
      promptsToSave[0].prompt
    );
  });

  it('should get quick replies', async () => {
    const mockReplies: PredefinedPrompt[] = [{ id: '1', title: 'Test Reply', prompt: 'Hi' }];
    mockDb.all.mockResolvedValue(mockReplies);
    const replies = await dao.getQuickReplies();
    expect(replies).toEqual(mockReplies);
    expect(mockDb.all).toHaveBeenCalledWith('SELECT id, title, prompt FROM quick_replies');
  });

  it('should save quick replies', async () => {
    const repliesToSave: PredefinedPrompt[] = [{ id: '2', title: 'New Reply', prompt: 'There' }];
    await dao.saveQuickReplies(repliesToSave);
    expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM quick_replies');
    expect(mockDb.run).toHaveBeenCalledWith(
      'INSERT INTO quick_replies (id, title, prompt) VALUES (?, ?, ?)',
      repliesToSave[0].id,
      repliesToSave[0].title,
      repliesToSave[0].prompt
    );
  });

  it('should get the global prompt', async () => {
    const mockPrompt = 'Global prompt';
    mockDb.get.mockResolvedValue({ prompt: mockPrompt });
    const prompt = await dao.getGlobalPrompt();
    expect(prompt).toBe(mockPrompt);
    expect(mockDb.get).toHaveBeenCalledWith('SELECT prompt FROM global_prompt LIMIT 1');
  });

  it('should return an empty string if no global prompt is set', async () => {
    mockDb.get.mockResolvedValue(undefined);
    const prompt = await dao.getGlobalPrompt();
    expect(prompt).toBe('');
  });

  it('should save the global prompt', async () => {
    const promptToSave = 'New global prompt';
    await dao.saveGlobalPrompt(promptToSave);
    expect(mockDb.run).toHaveBeenCalledWith('DELETE FROM global_prompt');
    expect(mockDb.run).toHaveBeenCalledWith('INSERT INTO global_prompt (prompt) VALUES (?)', promptToSave);
  });
});
