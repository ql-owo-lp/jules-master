
import { NextResponse } from 'next/server';
import { db, getActiveProfileId } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { settingsSchema } from '@/lib/validation';

export async function GET() {
  try {
    const profileId = await getActiveProfileId();
    const result = await db.select().from(schema.settings).where(eq(schema.settings.profileId, profileId)).limit(1);

    if (result.length === 0) {
       // Should have been created by getActiveProfileId, but just in case
       return NextResponse.json({
        idlePollInterval: 120,
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
        autoRetryMessage: "You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution",
        autoContinueEnabled: true,
        autoContinueMessage: "Sounds good. Now go ahead finish the work",
        sessionCacheInProgressInterval: 60,
        sessionCacheCompletedNoPrInterval: 1800,
        sessionCachePendingApprovalInterval: 300,
        sessionCacheMaxAgeDays: 3,
        autoDeleteStaleBranches: false,
        autoDeleteStaleBranchesAfterDays: 3,
        historyPromptsCount: 10,
      });
    }

    // Fetch profile credentials as well, to merge into response?
    // The settings page expects API keys separately usually, but let's check.
    // In page.tsx: const [apiKey, setApiKey] = useLocalStorage...
    // We want to move away from local storage.

    const profile = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profileId)).get();

    return NextResponse.json({
        ...result[0],
        julesApiKey: profile?.julesApiKey,
        githubToken: profile?.githubToken,
        julesApiUrl: profile?.julesApiUrl
    });

  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'At least one setting must be provided.' }, { status: 400 });
    }

    // validation schema might need updates if we include tokens in body
    // or we separate them.
    // For now, let's assume body might contain tokens too.

    const { julesApiKey, githubToken, julesApiUrl, ...settingsData } = body;

    const validation = settingsSchema.safeParse(settingsData);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    const profileId = await getActiveProfileId();

    // Update Profile Credentials
    const profileUpdates: any = {};
    if (julesApiKey !== undefined) profileUpdates.julesApiKey = julesApiKey;
    if (githubToken !== undefined) profileUpdates.githubToken = githubToken;
    if (julesApiUrl !== undefined) profileUpdates.julesApiUrl = julesApiUrl;

    if (Object.keys(profileUpdates).length > 0) {
        await db.update(schema.profiles).set({ ...profileUpdates, updatedAt: new Date().toISOString() }).where(eq(schema.profiles.id, profileId));
    }

    const newSettings = {
      profileId,
      ...validation.data,
    };

    const existing = await db.select().from(schema.settings).where(eq(schema.settings.profileId, profileId)).limit(1);

    if (existing.length > 0) {
        await db.update(schema.settings).set(newSettings).where(eq(schema.settings.id, existing[0].id));
    } else {
        await db.insert(schema.settings).values(newSettings);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
