
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings, profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { settingsSchema } from '@/lib/validation';
import { ensureDefaultProfile } from '@/lib/profile-utils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');

    // Ensure data integrity on every access (lazy migration)
    await ensureDefaultProfile();

    let result;

    if (profileId) {
        result = await db.select().from(settings).where(eq(settings.profileId, profileId)).limit(1);
    } else {
        // If no profileId, get the selected profile
        const selectedProfile = await db.select().from(profiles).where(eq(profiles.isSelected, true)).limit(1);

        if (selectedProfile.length > 0) {
             result = await db.select().from(settings).where(eq(settings.profileId, selectedProfile[0].id)).limit(1);
        } else {
             // Should not happen after ensureDefaultProfile()
             result = [];
        }
    }

    if (result.length === 0) {
      // Return default settings if none exist in DB (should theoretically be handled by ensureDefaultProfile creating them, but as a fallback)
      return NextResponse.json({
        julesApiKey: "",
        githubToken: "",
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

    const validation = settingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    // Ensure data integrity
    await ensureDefaultProfile();

    // Determine which profile to update
    // If request body has profileId, use it? Schema doesn't have it.
    // The client should probably pass it in query param or we assume selected profile.
    // But `settingsSchema` is strict.

    // Let's get the currently selected profile.
    const selectedProfile = await db.select().from(profiles).where(eq(profiles.isSelected, true)).limit(1);

    if (selectedProfile.length === 0) {
         return NextResponse.json({ error: 'No profile selected to update settings for.' }, { status: 400 });
    }

    const targetProfileId = selectedProfile[0].id;

    const newSettings = {
      profileId: targetProfileId,
      ...validation.data,
    };

    // Check if settings exist for this profile
    const existing = await db.select().from(settings).where(eq(settings.profileId, targetProfileId)).limit(1);

    if (existing.length > 0) {
        // We shouldn't change ID, so exclude it if it was in `newSettings` (it's not).
        await db.update(settings).set(newSettings).where(eq(settings.id, existing[0].id));
    } else {
        await db.insert(settings).values(newSettings);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
