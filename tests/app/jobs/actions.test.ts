
import { vi } from 'vitest';
import { createJob } from '@/app/jobs/actions';
import * as julesApi from '@/lib/jules-api';
import * as generateTitle from '@/ai/generate-title';
import { db } from '@/lib/db';

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));
vi.mock('@/lib/jules-api');
vi.mock('@/ai/generate-title');
vi.mock('@/lib/db', () => ({
    db: {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn(),
    },
}));

describe('createJob', () => {
    beforeEach(() => {
        process.env.JULES_API_KEY = 'test-api-key';
    });

    it('should create a new job and sessions', async () => {
        const prompts = ['prompt1', 'prompt2'];
        const mockCreateJulesJob = vi.spyOn(julesApi, 'createJob').mockResolvedValue({
            id: '123',
            state: 'running',
            pr_url: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        const mockGenerateTitle = vi.spyOn(generateTitle, 'generateTitle').mockResolvedValue('Test Title');

        await createJob(prompts);

        expect(mockGenerateTitle).toHaveBeenCalledWith(prompts.join('\n'));
        expect(db.insert).toHaveBeenCalledTimes(3);
        expect(mockCreateJulesJob).toHaveBeenCalledTimes(2);
    });
});
