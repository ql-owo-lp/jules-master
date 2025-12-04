
import { GET } from '@/app/api/cron-jobs/[id]/history/route';
import { getCronJobHistory } from '@/app/settings/actions';
import { NextResponse } from 'next/server';

vi.mock('@/app/settings/actions');

describe('GET /api/cron-jobs/[id]/history', () => {
    it('should return the cron job history', async () => {
        const mockJobs = [{ id: 'job-1', name: 'Test Job', status: 'completed', createdAt: new Date().toISOString() }];
        const mockHistory = { jobs: mockJobs, totalPages: 1 };
        (getCronJobHistory as vi.Mock).mockResolvedValue(mockHistory);

        const request = new Request('http://localhost/api/cron-jobs/cron-1/history?page=1&limit=10&status=all');
        const response = await GET(request, { params: { id: 'cron-1' } });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual(mockHistory);
        expect(getCronJobHistory).toHaveBeenCalledWith('cron-1', 1, 10, 'all');
    });

    it('should return an error if fetching fails', async () => {
        (getCronJobHistory as vi.Mock).mockRejectedValue(new Error('Failed to fetch'));

        const request = new Request('http://localhost/api/cron-jobs/cron-1/history?page=1&limit=10&status=all');
        const response = await GET(request, { params: { id: 'cron-1' } });
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data).toEqual({ error: 'Failed to fetch cron job history' });
    });
});
