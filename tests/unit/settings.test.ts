
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST, GET } from '@/app/api/settings/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { settings, profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Settings API', () => {
  const profileId = 'test-profile-settings';

  beforeAll(async () => {
    // Create a dummy profile
    await db.insert(profiles).values({ id: profileId, name: 'Test Profile', createdAt: new Date().toISOString() }).onConflictDoNothing();
    // Clean up the settings table before each test run
    await db.delete(settings).where(eq(settings.profileId, profileId));
  });

  afterAll(async () => {
    // Clean up the settings table after each test run
    await db.delete(settings).where(eq(settings.profileId, profileId));
    await db.delete(profiles).where(eq(profiles.id, profileId));
  });

  it('should return 400 for invalid data', async () => {
    const invalidData = {
      profileId,
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
      profileId,
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
    };

    const postReq = new NextRequest(`http://localhost/api/settings?profileId=${profileId}`, {
      method: 'POST',
      body: JSON.stringify(newSettings),
    });

    const postResponse = await POST(postReq);
    expect(postResponse.status).toBe(200);

    const getReq = new NextRequest(`http://localhost/api/settings?profileId=${profileId}`);
    const getResponse = await GET(getReq);
    const retrievedSettings = await getResponse.json();

    // remove profileId from comparison as it's not in the response body usually (or it is?)
    // The GET endpoint returns result[0] which includes all columns.
    // So profileId should be there.
    expect(retrievedSettings).toEqual(expect.objectContaining(newSettings));
  });
});
