
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { POST, GET } from '@/app/api/settings/route';
import { NextRequest } from 'next/server';
import { settingsClient } from '@/lib/grpc-client';

vi.mock('@/lib/grpc-client', () => ({
  settingsClient: {
      updateSettings: vi.fn(),
      getSettings: vi.fn(),
  }
}));

describe('Settings API - Profile Isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

  it('should save and retrieve distinct settings for different profiles', async () => {
    // 1. Save settings for Profile A
    const settingsA = {
      idlePollInterval: 100,
      activePollInterval: 30,
      titleTruncateLength: 50,
      lineClamp: 1,
      sessionItemsPerPage: 10,
      jobsPerPage: 5,
      defaultSessionCount: 10,
      prStatusPollInterval: 60,
      theme: 'system',
      autoApprovalInterval: 60,
      autoRetryEnabled: true,
      autoRetryMessage: "Retry",
      autoContinueEnabled: true,
      autoContinueMessage: "Continue",
      sessionCacheInProgressInterval: 60,
      sessionCacheCompletedNoPrInterval: 1800,
      sessionCachePendingApprovalInterval: 300,
      sessionCacheMaxAgeDays: 3,
      autoDeleteStaleBranches: false,
      autoDeleteStaleBranchesAfterDays: 3,
      historyPromptsCount: 10,
      minSessionInteractionInterval: 60,
      retryTimeout: 1200,
      autoDeleteStaleBranchesInterval: 1800,
      profileId: 'profile-a'
    };

    (settingsClient.updateSettings as unknown as Mock).mockImplementation((req, callback) => {
        callback(null, {});
    });

    const resPostA = await POST(new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify(settingsA),
    }));
    expect(resPostA.status).toBe(200);

    // 2. Save different settings for Profile B
    const settingsB = { ...settingsA, idlePollInterval: 200, profileId: 'profile-b' };
    const resPostB = await POST(new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify(settingsB),
    }));
    expect(resPostB.status).toBe(200);

    // 3. Fetch settings for Profile A
    (settingsClient.getSettings as unknown as Mock).mockImplementation((req, callback) => {
        if (req.profileId === 'profile-a') {
            callback(null, { ...settingsA, id: '1' });
        } else if (req.profileId === 'profile-b') {
            callback(null, { ...settingsB, id: '2' });
        } else {
             // Mock default returns
            callback(null, { idlePollInterval: 120, id: '0' });
        }
    });

    const resA = await GET(new NextRequest(`http://localhost/api/settings?profileId=profile-a`));
    const dataA = await resA.json();
    expect(dataA.idlePollInterval).toBe(100);

    // 4. Fetch settings for Profile B
    const resB = await GET(new NextRequest(`http://localhost/api/settings?profileId=profile-b`));
    const dataB = await resB.json();
    expect(dataB.idlePollInterval).toBe(200);

    // 5. Fetch settings for non-existent profile (should return defaults from mock)
    const resDefault = await GET(new NextRequest(`http://localhost/api/settings?profileId=non-existent`));
    const dataDefault = await resDefault.json();
    expect(dataDefault.idlePollInterval).toBe(120); // Default value from mock
  });
});
