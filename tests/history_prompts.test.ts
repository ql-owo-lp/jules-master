
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { saveHistoryPrompt, getHistoryPrompts } from '@/app/config/actions';
import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';

// Mock the dependencies
vi.mock('@/lib/db', () => {
  const mockHistoryPrompts: any[] = [];

  // Create chainable mock for db.select()...
  const mockChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn(),
  };

  return {
    db: {
      select: vi.fn(() => mockChain),
      transaction: vi.fn(),
      insert: vi.fn(() => ({ values: vi.fn(() => ({ run: vi.fn() })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    },
    appDatabase: {
      historyPrompts: {
        getRecent: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      jobs: { getAll: vi.fn(), create: vi.fn() },
      predefinedPrompts: { getAll: vi.fn() },
      globalPrompt: { get: vi.fn(), save: vi.fn() },
    },
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('History Prompts', () => {
  const profileId = 'test-profile-history';

  beforeEach(() => {
      vi.clearAllMocks();
  });

  it('should save a new history prompt', async () => {
     const prompt = "New Prompt";

     // Setup mocks
     // Mock db.select().from().where().where().get() to return undefined (not found)
     // We need to access the mock object returned by the factory above
     const mockDb = (db.select() as any);
     mockDb.get.mockResolvedValue(undefined);

     await saveHistoryPrompt(prompt, profileId);

     expect(appDatabase.historyPrompts.create).toHaveBeenCalled();
     const createCall = (appDatabase.historyPrompts.create as any).mock.calls[0][0];
     expect(createCall.prompt).toBe(prompt);
     expect(createCall.profileId).toBe(profileId);
  });

  it('should update an existing history prompt', async () => {
     const prompt = "Existing Prompt";
     const existingRecord = { id: '123', prompt: prompt, lastUsedAt: 'old-date', profileId: profileId };

     // Setup mocks
     const mockDb = (db.select() as any);
     mockDb.get.mockResolvedValue(existingRecord);

     await saveHistoryPrompt(prompt, profileId);

     expect(appDatabase.historyPrompts.update).toHaveBeenCalledWith(existingRecord.id, expect.objectContaining({
         lastUsedAt: expect.any(String)
     }));
  });
});
