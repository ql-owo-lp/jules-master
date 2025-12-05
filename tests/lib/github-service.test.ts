
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as fetchClient from '@/lib/fetch-client';
import { deleteBranch } from '@/lib/github-service';

describe('deleteBranch', () => {
    beforeEach(() => {
        vi.spyOn(fetchClient, 'fetchWithRetry').mockResolvedValue({
            ok: true,
        } as Response);
    });

    it('should return false if the GitHub token is not configured', async () => {
        process.env.GITHUB_TOKEN = '';
        const result = await deleteBranch('test-repo', 'test-branch');
        expect(result).toBe(false);
    });

    it('should return true on a successful deletion', async () => {
        process.env.GITHUB_TOKEN = 'test-token';
        const result = await deleteBranch('test-repo', 'test-branch');
        expect(result).toBe(true);
    });

    it('should return false if the branch is not found', async () => {
        process.env.GITHUB_TOKEN = 'test-token';
        vi.spyOn(fetchClient, 'fetchWithRetry').mockResolvedValue({
            ok: false,
            status: 404,
        } as Response);

        const result = await deleteBranch('test-repo', 'test-branch');
        expect(result).toBe(false);
    });

    it('should return false if the branch cannot be processed', async () => {
        process.env.GITHUB_TOKEN = 'test-token';
        vi.spyOn(fetchClient, 'fetchWithRetry').mockResolvedValue({
            ok: false,
            status: 422,
        } as Response);

        const result = await deleteBranch('test-repo', 'test-branch');
        expect(result).toBe(false);
    });

    it('should return false on a failed deletion', async () => {
        process.env.GITHUB_TOKEN = 'test-token';
        vi.spyOn(fetchClient, 'fetchWithRetry').mockResolvedValue({
            ok: false,
            status: 500,
        } as Response);

        const result = await deleteBranch('test-repo', 'test-branch');
        expect(result).toBe(false);
    });
});
