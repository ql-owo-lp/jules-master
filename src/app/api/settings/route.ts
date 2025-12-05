
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings, profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { settingsSchema } from '@/lib/validation';

// Helper to ensure at least one profile exists (Migration logic on the fly)
async function ensureDefaultProfile() {
    const allProfiles = await db.select().from(profiles).limit(1);
    if (allProfiles.length === 0) {
        console.log("No profiles found. Creating Default profile and migrating settings...");
        const defaultProfileId = crypto.randomUUID();
        const now = new Date().toISOString();

        // Create Default Profile
        await db.insert(profiles).values({
            id: defaultProfileId,
            name: 'Default',
            isSelected: true,
            createdAt: now,
        });

        // Link existing settings if any (assuming id=1 was the old singleton)
        // Check if there are any settings rows
        const existingSettings = await db.select().from(settings).limit(1);
        if (existingSettings.length > 0) {
             // If we have settings but they might have null profileId (if they were from before migration)
             // or if we just added the column.
             // We update ALL existing settings to this profile if they don't have one?
             // Or specifically the one with id=1?
             // Since we only had one row before (id=1), let's target that or just update where profileId is null.
             await db.update(settings)
                .set({ profileId: defaultProfileId })
                .where(eq(settings.id, 1)); // Assuming legacy row was id=1

             // Also update any other rows just in case?
             // await db.update(settings).set({ profileId: defaultProfileId }).where(isNull(settings.profileId));
             // (Need isNull import)
        } else {
             // No settings exist, create default settings for this profile
             // (Though GET /api/settings handles returning defaults if no row exists,
             // but strictly speaking we might want a row in DB)
             // Let's leave it to GET to return defaults if DB is empty,
             // or create one here.
             // POST /api/profiles creates one.
             await db.insert(settings).values({
                 profileId: defaultProfileId,
                 theme: 'system',
             });
        }
        return defaultProfileId;
    }
    return null;
}

export async function GET(request: Request) {
  try {
    // Ensure default profile exists (migration check)
    await ensureDefaultProfile();

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId');

    let result;
    if (profileId) {
        result = await db.select().from(settings).where(eq(settings.profileId, profileId)).limit(1);
    } else {
        // If no profileId provided, get the selected profile's settings
        const selectedProfile = await db.select().from(profiles).where(eq(profiles.isSelected, true)).limit(1);
        if (selectedProfile.length > 0) {
            result = await db.select().from(settings).where(eq(settings.profileId, selectedProfile[0].id)).limit(1);
        } else {
             // Should not happen due to ensureDefaultProfile, but handle race/edge case
             console.warn("No selected profile found even after ensureDefaultProfile.");
             return NextResponse.json({ error: 'No active profile found' }, { status: 404 });
        }
    }

    if (result.length === 0) {
      // Return default settings if none exist in DB for this profile
      // This matches legacy behavior where if DB was empty, defaults were returned.
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

    // Check if we are updating a specific profile or the active one
    let profileId = body.profileId; // Not part of schema validation, so extract it first if present

    if (!profileId) {
         // Ensure default profile exists (migration check)
         await ensureDefaultProfile();

         const selectedProfile = await db.select().from(profiles).where(eq(profiles.isSelected, true)).limit(1);
         if (selectedProfile.length > 0) {
             profileId = selectedProfile[0].id;
         } else {
             return NextResponse.json({ error: 'No active profile found to update' }, { status: 404 });
         }
    }

    // Remove profileId from body before validation if it's there, as it's not in settingsSchema
    const { profileId: _, ...settingsData } = body;

    const validation = settingsSchema.safeParse(settingsData);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    const newSettings = {
      profileId: profileId,
      ...validation.data,
    };

    // Check if settings exist for this profile
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
