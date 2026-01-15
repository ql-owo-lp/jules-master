
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { POST, GET } from '@/app/api/settings/route';
import { NextRequest } from 'next/server';
import { settingsClient } from '@/lib/grpc-client';

vi.mock('@/lib/grpc-client', () => ({
  settingsClient: {
    updateSettings: vi.fn(),
    getSettings: vi.fn(),
  },
}));

describe('Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 for invalid data', async () => {
    const invalidData = {
      idlePollInterval: 'not-a-number',
    };
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('should save and retrieve settings correctly', async () => {
    const newSettings = {
      idlePollInterval: 150,
      activePollInterval: 45,
      titleTruncateLength: 60,
      lineClamp: 2,
      sessionItemsPerPage: 15,
      jobsPerPage: 10,
      defaultSessionCount: 5,
      prStatusPollInterval: 75,
      theme: 'dark',
      autoApprovalInterval: 90,
      autoRetryEnabled: false,
      autoRetryMessage: 'Test retry message',
      autoContinueEnabled: false,
      autoContinueMessage: 'Test continue message',
      sessionCacheInProgressInterval: 70,
      sessionCacheCompletedNoPrInterval: 1900,
      sessionCachePendingApprovalInterval: 400,
      sessionCacheMaxAgeDays: 5,
      autoDeleteStaleBranches: true,
      autoDeleteStaleBranchesAfterDays: 7,
      historyPromptsCount: 20,
      minSessionInteractionInterval: 300,
      retryTimeout: 1200,
    };

    // Mock Update
    (settingsClient.updateSettings as unknown as Mock).mockImplementation((req, callback) => {
        callback(null, {});
    });

    const postReq = new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify(newSettings),
    });

    const postResponse = await POST(postReq);
    expect(postResponse.status).toBe(200);

    // Mock Get
    (settingsClient.getSettings as unknown as Mock).mockImplementation((req, callback) => {
        callback(null, { ...newSettings, id: '1', profileId: 'default' });
    });

    const getResponse = await GET(new NextRequest('http://localhost/api/settings'));
    const retrievedSettings = await getResponse.json();

    expect(retrievedSettings).toEqual(expect.objectContaining(newSettings));
  });
});
