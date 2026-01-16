
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';
import { useLocalStorage } from "@/hooks/use-local-storage";
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// Mock dependencies
vi.mock('@/hooks/use-local-storage');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: (key: string) => key === 'tab' ? 'automation' : null, toString: () => '' }),
  usePathname: () => '/settings',
}));
vi.mock('next-themes', () => ({
  useTheme: () => ({ setTheme: vi.fn() }),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/components/env-provider', () => ({
  useEnv: () => ({ hasJulesApiKey: true, hasGithubToken: true }),
}));
vi.mock('@/app/config/actions', () => ({
  getPredefinedPrompts: vi.fn().mockResolvedValue([]),
  getQuickReplies: vi.fn().mockResolvedValue([]),
  getGlobalPrompt: vi.fn().mockResolvedValue(''),
  getRepoPrompt: vi.fn().mockResolvedValue(''),
}));
vi.mock('@/app/sessions/actions', () => ({
  listSources: vi.fn().mockResolvedValue([]),
}));

const mockedUseLocalStorage = useLocalStorage as Mock;

describe('SettingsPage Verification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default localStorage mock implementation
        mockedUseLocalStorage.mockImplementation((key, defaultValue) => {
            return [defaultValue, vi.fn()];
        });
        
        // Mock fetch for settings API
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                checkFailingActionsEnabled: true,
                autoCloseStaleConflictedPrs: true,
            }),
        } as Response);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should display "Check Failing Actions" and "Auto Close Stale Conflicted PRs" settings', async () => {
        render(<SettingsPage />);

        // Verify "Check Failing Actions" is present
        await waitFor(() => {
             expect(screen.getByText('Check Failing Actions')).toBeInTheDocument();
             expect(screen.getByText('Automatically post a comment when PR checks fail.')).toBeInTheDocument();
        });

        // Verify "Auto Close Stale Conflicted PRs" is present
        expect(screen.getByText('Auto Close Stale Conflicted PRs')).toBeInTheDocument();
        expect(screen.getByText('Automatically close open PRs with conflicts if older than threshold.')).toBeInTheDocument();
    });
});
