
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSettings } from '@/app/config/actions';
import * as db from '@/lib/db';
import { revalidatePath } from 'next/cache';

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        db: {
            query: {
                settings: {
                    findFirst: vi.fn(),
                },
            },
        },
        appDatabase: {
            jobs: {
                create: vi.fn(),
            },
        },
    };
});
vi.mock('@/app/settings/profiles', () => ({
    getSelectedProfile: vi.fn().mockResolvedValue({ id: 'profile-123' }),
}));

describe('Config Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return the settings from the database', async () => {
      const mockSettings = { autoContinueEnabled: true, autoRetryEnabled: true };
      (db.db.query.settings.findFirst as vi.Mock).mockResolvedValue(mockSettings);

      const settings = await getSettings();
      expect(db.db.query.settings.findFirst).toHaveBeenCalled();
      expect(settings).toEqual(mockSettings);
    });

    it('should return null if no settings are found', async () => {
      (db.db.query.settings.findFirst as vi.Mock).mockResolvedValue(null);

      const settings = await getSettings();
      expect(db.db.query.settings.findFirst).toHaveBeenCalled();
      expect(settings).toBeNull();
    });
  });

    describe('addJob', () => {
        it('should add a job with a profileId', async () => {
            const { addJob } = await import('@/app/config/actions');
            const jobData = {
                id: 'job-1',
                name: 'Test Job',
                sessionIds: [],
                createdAt: new Date().toISOString(),
                repo: 'test/repo',
                branch: 'main',
            };

            await addJob(jobData);

            expect(db.appDatabase.jobs.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...jobData,
                    profileId: 'profile-123',
                })
            );
        });
    });
});
