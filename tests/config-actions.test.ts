
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as configActions from '@/app/config/actions';
import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';

vi.mock('@/lib/db', () => ({
  appDatabase: {
    jobs: {
      getAll: vi.fn(),
      create: vi.fn(),
    },
    predefinedPrompts: {
      getAll: vi.fn(),
    },
    historyPrompts: {
        getRecent: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
    },
    quickReplies: {
      getAll: vi.fn(),
    },
    globalPrompt: {
        get: vi.fn(),
        save: vi.fn(),
    },
    repoPrompts: {
        get: vi.fn(),
        save: vi.fn(),
    }
  },
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    get: vi.fn(),
    transaction: vi.fn(),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    run: vi.fn(),
    where: vi.fn().mockReturnThis(),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Config Actions', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('getJobs should call appDatabase.jobs.getAll', async () => {
        await configActions.getJobs();
        expect(appDatabase.jobs.getAll).toHaveBeenCalled();
    });

    it('addJob should call appDatabase.jobs.create and revalidate paths', async () => {
        const job = { id: '1', name: 'Test Job' } as any;
        await configActions.addJob(job);
        expect(appDatabase.jobs.create).toHaveBeenCalledWith(job);
        expect(revalidatePath).toHaveBeenCalledWith('/jobs');
        expect(revalidatePath).toHaveBeenCalledWith('/');
    });

    it('getPredefinedPrompts should call appDatabase.predefinedPrompts.getAll', async () => {
        await configActions.getPredefinedPrompts();
        expect(appDatabase.predefinedPrompts.getAll).toHaveBeenCalled();
    });

    it('savePredefinedPrompts should delete and insert prompts', async () => {
        const prompts = [{ id: '1', title: 'Test Prompt' }] as any;
        (db.transaction as any).mockImplementation(callback => callback(db));
        await configActions.savePredefinedPrompts(prompts);
        expect(db.delete).toHaveBeenCalledWith(schema.predefinedPrompts);
        expect(db.insert).toHaveBeenCalledWith(schema.predefinedPrompts);
        expect(db.values).toHaveBeenCalledWith(prompts);
        expect(revalidatePath).toHaveBeenCalledWith('/prompts');
    });

    it('getHistoryPrompts should fetch recent prompts', async () => {
        vi.mocked(db.get).mockResolvedValue({ historyPromptsCount: 5 });
        await configActions.getHistoryPrompts();
        expect(appDatabase.historyPrompts.getRecent).toHaveBeenCalledWith(5);
    });

    it('saveHistoryPrompt should create a new prompt if it does not exist', async () => {
        vi.mocked(db.get).mockResolvedValue(undefined);
        await configActions.saveHistoryPrompt('new prompt');
        expect(appDatabase.historyPrompts.create).toHaveBeenCalled();
        expect(revalidatePath).toHaveBeenCalledWith('/');
    });

    it('saveHistoryPrompt should update a prompt if it exists', async () => {
        vi.mocked(db.get).mockResolvedValue({ id: '1', prompt: 'existing prompt' });
        await configActions.saveHistoryPrompt('existing prompt');
        expect(appDatabase.historyPrompts.update).toHaveBeenCalled();
        expect(revalidatePath).toHaveBeenCalledWith('/');
    });
});
