
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { updateCronJob } from '@/app/settings/actions';

// Mock the actions module
vi.mock('@/app/settings/actions', () => ({
    updateCronJob: vi.fn(),
    toggleCronJob: vi.fn(),
    deleteCronJob: vi.fn(),
}));

describe('PUT /api/cron-jobs/[id]', () => {

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should reject invalid data types (Security Fix Verification)', async () => {
        const { PUT } = await import('@/app/api/cron-jobs/[id]/route');

        const params = Promise.resolve({ id: '123' });
        const invalidData = {
            name: 12345, // Invalid type, should be string
        };

        const request = {
            json: async () => invalidData,
        } as unknown as Request;

        const response = await PUT(request, { params });
        const json = await response.json();

        // Expect validation failure
        expect(response.status).toBe(400);
        expect(json).toHaveProperty('error');
        expect(updateCronJob).not.toHaveBeenCalled();
    });

    it('should strip unknown fields (Sanitization)', async () => {
         const { PUT } = await import('@/app/api/cron-jobs/[id]/route');

        const params = Promise.resolve({ id: '123' });
        const mixedData = {
            name: 'Valid Name',
            extraField: 'Malicious',
            isAdmin: true
        };

        const request = {
            json: async () => mixedData,
        } as unknown as Request;

        const response = await PUT(request, { params });

        expect(response.status).toBe(200);

        expect(updateCronJob).toHaveBeenCalledTimes(1);
        const calledArg = vi.mocked(updateCronJob).mock.calls[0][1];

        expect(calledArg).toHaveProperty('name', 'Valid Name');
        expect(calledArg).not.toHaveProperty('extraField');
        expect(calledArg).not.toHaveProperty('isAdmin');
    });
});
