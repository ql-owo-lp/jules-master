
import { getCronJobHistory } from '@/app/settings/actions';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
    db: {
        select: vi.fn().mockImplementation((selectArgs) => {
            if (selectArgs && selectArgs.count) {
                return {
                    from: vi.fn().mockReturnThis(),
                    where: vi.fn().mockResolvedValue([{ count: 1 }]),
                };
            } else {
                return {
                    from: vi.fn().mockReturnThis(),
                    where: vi.fn().mockReturnThis(),
                    orderBy: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockReturnThis(),
                    offset: vi.fn().mockResolvedValue([{ id: 'job-1', name: 'Test Job', status: 'completed', createdAt: new Date().toISOString() }]),
                };
            }
        }),
    }
}));

describe('getCronJobHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch cron job history', async () => {
        const result = await getCronJobHistory('cron-1', 1, 10, 'all');

        expect(result.jobs).toEqual([{ id: 'job-1', name: 'Test Job', status: 'completed', createdAt: expect.any(String) }]);
        expect(result.totalPages).toBe(1);
        expect(db.select).toHaveBeenCalledTimes(2);
    });
});
