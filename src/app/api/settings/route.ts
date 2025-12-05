
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
        // Fetch for selected profile
        const selectedProfile = await db.select().from(profiles).where(eq(profiles.isSelected, true)).limit(1);
        if (selectedProfile.length > 0) {
            result = await db.select().from(settings).where(eq(settings.profileId, selectedProfile[0].id)).limit(1);
        } else {
            // Fallback to any settings or default
            // This case should ideally not happen if migration worked
             result = await db.select().from(settings).limit(1);
        }
    }

    if (result.length === 0) {
      // Return default settings if none exist
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

    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'At least one setting must be provided.' }, { status: 400 });
    }

    // Check if profileId is provided in body, otherwise use selected profile
    // Note: settingsSchema does not include profileId, so we extract it separately or check context.
    // However, the FE `SettingsPage` calls this endpoint.

    // We need to know which profile to update.
    // Ideally, the FE should pass `profileId`?
    // Or we update the *active* profile.

    // Let's assume we update the active profile unless specified.

    // If the body contains `profileId` (even if not in schema), we could use it?
    // But let's stick to: "POST updates the currently selected profile's settings"

    const validation = settingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    // Find selected profile
    const selectedProfile = await db.select().from(profiles).where(eq(profiles.isSelected, true)).limit(1);

    if (selectedProfile.length === 0) {
         return NextResponse.json({ error: 'No active profile found.' }, { status: 404 });
    }

    const profileId = selectedProfile[0].id;

    const newSettings = {
      // id: 1, // No longer enforce id=1
      ...validation.data,
      profileId: profileId
    };

    const existing = await db.select().from(settings).where(eq(settings.profileId, profileId)).limit(1);

    if (existing.length > 0) {
        await db.update(settings).set(newSettings).where(eq(settings.profileId, profileId));
    } else {
        await db.insert(settings).values(newSettings);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
