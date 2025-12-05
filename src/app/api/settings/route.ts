
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings, profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { settingsSchema } from '@/lib/validation';

export async function GET() {
  try {
    // Get the active profile
    const activeProfile = await db.select().from(profiles).where(eq(profiles.isActive, true)).limit(1);

    if (activeProfile.length === 0) {
        // Fallback or error? Should theoretically not happen after seeding.
        return NextResponse.json({ error: 'No active profile found' }, { status: 500 });
    }

    const profileId = activeProfile[0].id;
    const result = await db.select().from(settings).where(eq(settings.profileId, profileId)).limit(1);

    if (result.length === 0) {
      // Create default settings if not exist for this profile
      const defaultSettings = {
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
        profileId: profileId
      };

      await db.insert(settings).values(defaultSettings);
      return NextResponse.json(defaultSettings);
    }

    return NextResponse.json(result[0]);
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

    const validation = settingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    // Get the active profile
    const activeProfile = await db.select().from(profiles).where(eq(profiles.isActive, true)).limit(1);
    if (activeProfile.length === 0) {
        return NextResponse.json({ error: 'No active profile found' }, { status: 500 });
    }
    const profileId = activeProfile[0].id;

    // Check if settings exist for this profile
    const existing = await db.select().from(settings).where(eq(settings.profileId, profileId)).limit(1);

    if (existing.length > 0) {
        await db.update(settings).set(validation.data).where(eq(settings.id, existing[0].id));
    } else {
        await db.insert(settings).values({
            ...validation.data,
            profileId: profileId
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
