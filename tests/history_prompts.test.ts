
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
                        // This is a very rough mock.
                        // In a real scenario, we'd need to parse the condition.
                        // For this test, we'll control the return via `vi.spyOn` in the test if needed,
                        // or just return undefined by default (simulate not found).
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
      insert: vi.fn().mockReturnValue({ 
        values: vi.fn().mockReturnValue({ run: vi.fn() }) 
      }),
      update: vi.fn().mockReturnValue({ 
        set: vi.fn().mockReturnValue({ 
          where: vi.fn().mockReturnValue({ run: vi.fn() }) 
        }) 
      }),
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

  it('should save a new history prompt', async () => {
     const prompt = "New Prompt";

     // Setup mocks
     const dbSelectMock = {
         from: vi.fn().mockReturnValue({
             where: vi.fn().mockReturnValue({
                 get: vi.fn().mockResolvedValue(undefined)
             })
         })
     };
     // @ts-ignore
     db.select.mockReturnValue(dbSelectMock);
     
     // Spy on the chain
     const runSpy = vi.fn();
     const valuesSpy = vi.fn().mockReturnValue({ run: runSpy });
     (db.insert as any).mockReturnValue({ values: valuesSpy });

     await saveHistoryPrompt(prompt);

     expect(db.insert).toHaveBeenCalledWith(schema.historyPrompts);
     expect(valuesSpy).toHaveBeenCalledWith(expect.objectContaining({
        prompt: prompt
     }));
     expect(runSpy).toHaveBeenCalled();
  });

  it('should update an existing history prompt', async () => {
     const prompt = "Existing Prompt";
     const existingRecord = { id: '123', prompt: prompt, lastUsedAt: 'old-date' };

     // Setup mocks
     const dbSelectMock = {
         from: vi.fn().mockReturnValue({
             where: vi.fn().mockReturnValue({
                 get: vi.fn().mockResolvedValue(existingRecord)
             })
         })
     };
     // @ts-ignore
     db.select.mockReturnValue(dbSelectMock);

     const runSpy = vi.fn();
     const whereSpy = vi.fn().mockReturnValue({ run: runSpy });
     const setSpy = vi.fn().mockReturnValue({ where: whereSpy });
     (db.update as any).mockReturnValue({ set: setSpy });

     await saveHistoryPrompt(prompt);

     expect(db.update).toHaveBeenCalledWith(schema.historyPrompts);
     expect(setSpy).toHaveBeenCalledWith(expect.objectContaining({
         lastUsedAt: expect.any(String)
     }));
     // We can't easily check 'where' arguments specifically here unless we match the exact sql/eq object, 
     // but verifying 'set' was called is sufficient to prove update logic ran.
     expect(runSpy).toHaveBeenCalled();
  });
});
