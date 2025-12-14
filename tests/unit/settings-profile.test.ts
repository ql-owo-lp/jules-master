
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST, GET } from '@/app/api/settings/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { settings, profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

describe('Settings API - Profile Isolation', () => {
  const profileIdA = 'profile-a';
  const profileIdB = 'profile-b';

  beforeAll(async () => {
    // Ensure profiles exist
    await db.insert(profiles).values({ id: profileIdA, name: 'Profile A', createdAt: new Date().toISOString() }).onConflictDoNothing();
    await db.insert(profiles).values({ id: profileIdB, name: 'Profile B', createdAt: new Date().toISOString() }).onConflictDoNothing();
  
    // Clean up settings for these profiles
    await db.delete(settings).where(eq(settings.profileId, profileIdA));
    await db.delete(settings).where(eq(settings.profileId, profileIdB));
  });

  afterAll(async () => {
    // Clean up
    await db.delete(settings).where(eq(settings.profileId, profileIdA));
    await db.delete(settings).where(eq(settings.profileId, profileIdB));
    await db.delete(profiles).where(eq(profiles.id, profileIdA));
    await db.delete(profiles).where(eq(profiles.id, profileIdB));
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
      profileId: profileIdA
    };
    const resPostA = await POST(new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify(settingsA),
    }));
    expect(resPostA.status).toBe(200);

    // 2. Save different settings for Profile B
    const settingsB = { ...settingsA, idlePollInterval: 200, profileId: profileIdB };
    const resPostB = await POST(new NextRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify(settingsB),
    }));
    expect(resPostB.status).toBe(200);

    // 3. Fetch settings for Profile A
    const resA = await GET(new NextRequest(`http://localhost/api/settings?profileId=${profileIdA}`));
    const dataA = await resA.json();
    expect(dataA.idlePollInterval).toBe(100);

    // 4. Fetch settings for Profile B
    const resB = await GET(new NextRequest(`http://localhost/api/settings?profileId=${profileIdB}`));
    const dataB = await resB.json();
    expect(dataB.idlePollInterval).toBe(200);

    // 5. Fetch settings for non-existent profile (should return defaults)
    const resDefault = await GET(new NextRequest(`http://localhost/api/settings?profileId=non-existent`));
    const dataDefault = await resDefault.json();
    expect(dataDefault.idlePollInterval).toBe(120); // Default value
  });
});
