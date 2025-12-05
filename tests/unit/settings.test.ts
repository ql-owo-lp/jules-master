
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST, GET } from '@/app/api/settings/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { settings, profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Settings API', () => {
  let testProfileId: string;
  const testProfileName = 'Test Profile ' + crypto.randomUUID(); // Make unique to avoid collision

  beforeAll(async () => {
    // Create a test profile and select it
    testProfileId = crypto.randomUUID();

    // Check if it exists (it shouldn't due to random name, but robust test)
    // Actually, just try catch insert
    try {
        await db.insert(profiles).values({
            id: testProfileId,
            name: testProfileName,
            isSelected: true,
            createdAt: new Date().toISOString(),
        });
    } catch (e) {
        // If collision, maybe clean up?
        console.error("Setup failed", e);
    }
  });

  afterAll(async () => {
    // Clean up
    if (testProfileId) {
        await db.delete(profiles).where(eq(profiles.id, testProfileId));
    }
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
    };

    const postReq = new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify(newSettings),
    });

    const postResponse = await POST(postReq);
    expect(postResponse.status).toBe(200);

    const getReq = new NextRequest('http://localhost/api/settings');
    const getResponse = await GET(getReq);
    const retrievedSettings = await getResponse.json();

    expect(retrievedSettings).toEqual(expect.objectContaining(newSettings));
  });
});
