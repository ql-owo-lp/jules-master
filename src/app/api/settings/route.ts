
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings, profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { settingsSchema } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');

    let result;

    if (profileId) {
        result = await db.select().from(settings).where(eq(settings.profileId, profileId)).limit(1);
    } else {
        // If no profileId provided, get settings for the selected profile
        const selectedProfile = await db.select().from(profiles).where(eq(profiles.isSelected, true)).limit(1);

        if (selectedProfile.length > 0) {
             result = await db.select().from(settings).where(eq(settings.profileId, selectedProfile[0].id)).limit(1);
        } else {
            // Fallback: try to find any profile or settings
             result = await db.select().from(settings).limit(1);
        }
    }

    if (!result || result.length === 0) {
      // Return default settings if none exist in DB
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

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const queryProfileId = searchParams.get('profileId');

    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'At least one setting must be provided.' }, { status: 400 });
    }

    const validation = settingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    let targetProfileId = queryProfileId;

    if (!targetProfileId) {
        // Find selected profile
         const selectedProfile = await db.select().from(profiles).where(eq(profiles.isSelected, true)).limit(1);
         if (selectedProfile.length > 0) {
             targetProfileId = selectedProfile[0].id;
         } else {
             // If no profile selected, maybe we should create one or fail?
             // For now let's assume there is always one due to migration.
             return NextResponse.json({ error: 'No active profile found' }, { status: 400 });
         }
    }

    const newSettings = {
      ...validation.data,
      profileId: targetProfileId,
    };

    // Remove id from newSettings if it exists, as we don't want to update ID
    // actually validation.data only contains fields from schema, which doesn't have ID or profileId.

    const existing = await db.select().from(settings).where(eq(settings.profileId, targetProfileId!)).limit(1);

    if (existing.length > 0) {
        await db.update(settings).set(newSettings).where(eq(settings.profileId, targetProfileId!));
    } else {
        await db.insert(settings).values(newSettings);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
