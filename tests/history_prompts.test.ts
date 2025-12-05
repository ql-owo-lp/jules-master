
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { saveHistoryPrompt, getHistoryPrompts } from '@/app/config/actions';
import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';

// Mock the dependencies
vi.mock('@/lib/db', () => {
  const mockHistoryPrompts: any[] = [];
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table) => {
             if (table === schema.settings) {
                 return {
                     get: vi.fn().mockResolvedValue({ historyPromptsCount: 5 })
                 }
             }
             return {
                where: vi.fn((condition) => ({
                    get: vi.fn().mockImplementation(() => {
                        return undefined;
                    })
                })),
                orderBy: vi.fn(() => ({
                     limit: vi.fn().mockResolvedValue([])
                }))
             }
        }),
      })),
      transaction: vi.fn(),
      insert: vi.fn(() => ({ values: vi.fn(() => ({ run: vi.fn() })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    },
    appDatabase: {
      historyPrompts: {
        getAll: vi.fn().mockResolvedValue([]), // Added getAll mock
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

  it('should save a new history prompt', async () => {
     const prompt = "New Prompt";

     // Setup mocks
     (appDatabase.historyPrompts.getAll as any).mockResolvedValue([]);

     await saveHistoryPrompt(prompt);

     expect(appDatabase.historyPrompts.create).toHaveBeenCalled();
     const createCall = (appDatabase.historyPrompts.create as any).mock.calls[0][0];
     expect(createCall.prompt).toBe(prompt);
  });

  it('should update an existing history prompt', async () => {
     const prompt = "Existing Prompt";
     const existingRecord = { id: '123', prompt: prompt, lastUsedAt: 'old-date' };

     // Setup mocks
     (appDatabase.historyPrompts.getAll as any).mockResolvedValue([existingRecord]);

     await saveHistoryPrompt(prompt);

     expect(appDatabase.historyPrompts.update).toHaveBeenCalledWith(existingRecord.id, expect.objectContaining({
         lastUsedAt: expect.any(String)
     }));
  });
});
