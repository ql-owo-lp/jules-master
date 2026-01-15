
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { saveHistoryPrompt, getHistoryPrompts } from '@/app/config/actions';
import { promptClient, settingsClient } from '@/lib/grpc-client';

vi.mock('@/lib/grpc-client', () => ({
  promptClient: {
    saveHistoryPrompt: vi.fn(),
    getRecentHistoryPrompts: vi.fn(),
  },
  settingsClient: {
    getSettings: vi.fn(),
  }
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('History Prompts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

  it('should save a new history prompt', async () => {
     const prompt = "New Prompt";

     (promptClient.saveHistoryPrompt as unknown as Mock).mockImplementation((req, callback) => {
         callback(null, {});
     });

     await saveHistoryPrompt(prompt);

     expect(promptClient.saveHistoryPrompt).toHaveBeenCalledWith({ prompt: prompt }, expect.any(Function));
  });

  // Since we don't have update logic explicitly exposed as a separate function that we test in isolation here easily
  // (it's hidden behind saveHistoryPrompt in the client), and the backend handles "save" as "create or update",
  // we just test that the same function calls the same gRPC endpoint.
  // The logic for "update" vs "insert" is on the backend now presumably, or handled by the create endpoint if we strictly follow the new proto?
  // Actually, Looking at `actions.ts`: `promptClient.saveHistoryPrompt` is called.
  // The backend implementation would handle checking if it exists.
  // So for the frontend unit test, we just verify the call.

  it('should call saveHistoryPrompt for existing prompt (same logic from client perspective)', async () => {
     const prompt = "Existing Prompt";

     (promptClient.saveHistoryPrompt as unknown as Mock).mockImplementation((req, callback) => {
         callback(null, {});
     });

     await saveHistoryPrompt(prompt);

     expect(promptClient.saveHistoryPrompt).toHaveBeenCalledWith({ prompt: prompt }, expect.any(Function));
  });

  it('should fetch history prompts', async () => {
    const mockPrompts = [{ id: '1', prompt: 'test', lastUsedAt: 'date', profileId: 'default' }];
    const mockSettings = { historyPromptsCount: 5 };

    (settingsClient.getSettings as unknown as Mock).mockImplementation((req, callback) => {
        callback(null, mockSettings);
    });

    (promptClient.getRecentHistoryPrompts as unknown as Mock).mockImplementation((req, callback) => {
        callback(null, { prompts: mockPrompts });
    });

    const prompts = await getHistoryPrompts();
    
    expect(settingsClient.getSettings).toHaveBeenCalled();
    expect(promptClient.getRecentHistoryPrompts).toHaveBeenCalledWith({ limit: 5 }, expect.any(Function));
    expect(prompts).toEqual(mockPrompts);
  });
});
