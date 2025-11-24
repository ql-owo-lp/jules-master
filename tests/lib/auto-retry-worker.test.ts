
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startAutoRetryWorker, runAutoRetryCheck } from '@/lib/auto-retry-worker';
import * as dbModule from '@/lib/db';
import * as idActions from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';

vi.mock('@/app/sessions/[id]/actions');

describe('AutoRetryWorker', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        process.env.JULES_API_KEY = 'test-api-key';

        const fromMock = vi.fn((tableName) => {
            let result;
            if (tableName === 'settings') {
                result = [{ autoRetryEnabled: true, autoRetryMessage: 'Retry?' }];
            } else if (tableName === 'jobs') {
                result = [{ id: 1, sessionIds: JSON.stringify(['1']) }];
            } else {
                result = [];
            }
            return {
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue(result),
            };
        });

        const dbMock = {
            select: vi.fn().mockReturnThis(),
            from: fromMock,
        };

        vi.spyOn(dbModule, 'db', 'get').mockReturnValue(dbMock as any);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        delete process.env.JULES_API_KEY;
    });

    it('should send a retry message to a failed session', async () => {
        const session: Session = {
            id: '1',
            state: 'FAILED',
            updateTime: new Date().toISOString(),
        } as any;

        vi.mocked(idActions.getSession).mockResolvedValue(session);
        vi.mocked(idActions.listActivities).mockResolvedValue([]);
        vi.mocked(idActions.sendMessage).mockResolvedValue(true);

        await runAutoRetryCheck();

        expect(idActions.sendMessage).toHaveBeenCalledWith('1', 'Retry?', 'test-api-key');
    });

    it('should not run if autoRetry is disabled', async () => {
        const fromMock = vi.fn((tableName) => {
            if (tableName === 'settings') {
                return {
                    where: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue([{ autoRetryEnabled: false }]),
                };
            }
            return {
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([]),
            };
        });
        const dbMock = {
            select: vi.fn().mockReturnThis(),
            from: fromMock,
        };
        vi.spyOn(dbModule, 'db', 'get').mockReturnValue(dbMock as any);

        await startAutoRetryWorker();

        expect(idActions.getSession).not.toHaveBeenCalled();
    });
});
