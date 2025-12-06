
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { saveHistoryPrompt, getHistoryPrompts } from '@/app/config/actions';
import { appDatabase, db } from '@/lib/db';
import * as schema from '@/lib/db/schema';

// Mock the dependencies
vi.mock('@/lib/db', () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table) => {
             if (table === schema.settings) {
                 return {
                     where: vi.fn(() => ({
                         get: vi.fn().mockResolvedValue({ historyPromptsCount: 5 })
                     })),
                     get: vi.fn().mockResolvedValue({ historyPromptsCount: 5 })
                 }
             }
             return {
                where: vi.fn((condition) => {
                    // Return a Thenable that resolves to an array (for await db.select...)
                    // And also has .get() for legacy calls if any
                    const result = [];
                    return {
                        then: (resolve: any) => resolve(result),
                        get: vi.fn().mockResolvedValue(undefined),
                        all: vi.fn().mockReturnValue(result)
                    };
                }),
                orderBy: vi.fn(() => ({
                     limit: vi.fn().mockResolvedValue([])
                }))
             }
        }),
      })),
      transaction: vi.fn((cb) => cb({
          insert: vi.fn(() => ({ values: vi.fn(() => ({ run: vi.fn() })) })),
          delete: vi.fn(() => ({ where: vi.fn(() => ({ run: vi.fn() })) })),
      })),
      insert: vi.fn(() => ({ values: vi.fn(() => ({ run: vi.fn() })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
      query: {
          settings: {
              findFirst: vi.fn()
          }
      }
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

// Mock profile service
vi.mock('@/lib/profile-service', () => ({
    getOrInitActiveProfileId: vi.fn().mockResolvedValue('test-profile-id')
}));

describe('History Prompts', () => {

  it('should save a new history prompt', async () => {
     const prompt = "New Prompt";

     // Setup mocks to return empty array for existing prompts
     const dbSelectMock = {
         from: vi.fn().mockReturnValue({
             where: vi.fn().mockReturnValue({
                 then: (resolve: any) => resolve([]), // Empty array found
                 get: vi.fn(),
                 all: vi.fn()
             })
         })
     };
     // @ts-ignore
     db.select.mockReturnValue(dbSelectMock);

     await saveHistoryPrompt(prompt);

     expect(appDatabase.historyPrompts.create).toHaveBeenCalled();
     const createCall = (appDatabase.historyPrompts.create as any).mock.calls[0][0];
     expect(createCall.prompt).toBe(prompt);
     expect(createCall.profileId).toBe('test-profile-id');
  });

  it('should update an existing history prompt', async () => {
     const prompt = "Existing Prompt";
     const existingRecord = { id: '123', prompt: prompt, lastUsedAt: 'old-date', profileId: 'test-profile-id' };

     // Setup mocks to return the existing record in the array
     const dbSelectMock = {
         from: vi.fn().mockReturnValue({
             where: vi.fn().mockReturnValue({
                 then: (resolve: any) => resolve([existingRecord]),
                 get: vi.fn(),
                 all: vi.fn()
             })
         })
     };
     // @ts-ignore
     db.select.mockReturnValue(dbSelectMock);

     await saveHistoryPrompt(prompt);

     expect(appDatabase.historyPrompts.update).toHaveBeenCalledWith(existingRecord.id, expect.objectContaining({
         lastUsedAt: expect.any(String)
     }));
  });
});
