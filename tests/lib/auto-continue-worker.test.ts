
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startAutoContinueWorker, runAutoContinueCheck } from '@/lib/auto-continue-worker';
import * as dbModule from '@/lib/db';
import * as idActions from '@/app/sessions/[id]/actions';
import type { Session } from '@/lib/types';

vi.mock('@/app/sessions/[id]/actions');

describe('AutoContinueWorker', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        process.env.JULES_API_KEY = 'test-api-key';
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        delete process.env.JULES_API_KEY;
    });

    it('should send a continue message to a completed session without a PR', async () => {
        const session: Session = {
            id: '1',
            state: 'COMPLETED',
            updateTime: new Date().toISOString(),
            outputs: [],
        } as any;

        const fromMock = vi.fn((tableName) => {
            let result;
            if (tableName === 'settings') {
                result = [{ autoContinueEnabled: true, autoContinueMessage: 'Continue?' }];
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
        vi.mocked(idActions.getSession).mockResolvedValue(session);
        vi.mocked(idActions.listActivities).mockResolvedValue([]);
        vi.mocked(idActions.sendMessage).mockResolvedValue(true);

        await runAutoContinueCheck();

        expect(idActions.sendMessage).toHaveBeenCalledWith('1', 'Continue?', 'test-api-key');
    });

    it('should not run if autoContinue is disabled', async () => {
        const fromMock = vi.fn((tableName) => {
            if (tableName === 'settings') {
                return {
                    where: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockResolvedValue([{ autoContinueEnabled: false }]),
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

        await startAutoContinueWorker();

        expect(idActions.getSession).not.toHaveBeenCalled();
    });
});
