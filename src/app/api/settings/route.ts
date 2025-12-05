
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { settingsSchema } from '@/lib/validation';

// This route should now return the "default" profile or the one requested by ID/Header.
// For backward compatibility, we can assume it returns the first profile or a specific default one.
// The frontend will likely switch to using /api/profiles endpoints.

// However, if other parts of the app rely on this, we should maintain it.
// Let's assume this route returns the *current* profile settings.
// Since we don't have session management yet, maybe we return the first profile.

export async function GET(req: NextRequest) {
  try {
    // Check if profileId is passed in header
    const profileId = req.headers.get('x-profile-id');

    let result;
    if (profileId) {
        result = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
    } else {
        // Fallback to first profile or default
        // If we don't have any profile, we might need to create one?
        result = await db.select().from(profiles).limit(1);
    }

    if (result.length === 0) {
       // If no profiles exist, create a default one
       const defaultProfile = {
           id: crypto.randomUUID(),
           name: "Default",
           createdAt: new Date().toISOString(),
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
       };
       await db.insert(profiles).values(defaultProfile);
       return NextResponse.json(defaultProfile);
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error fetching settings/profile:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const profileId = request.headers.get('x-profile-id');
    const body = await request.json();

    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'At least one setting must be provided.' }, { status: 400 });
    }

    // We use partial validation because the body might not contain all fields (e.g. name, tokens)
    // or might contain extra fields not in settingsSchema.
    // However, if we want to validate the settings part, we can use settingsSchema.partial().safeParse(body).
    // But the original test expects strict validation for specific fields.

    // Let's validate but ignore fields not in schema (passthrough) or just validate specific fields if present.
    // Since settingsSchema defines the structure of settings columns, we can try to validate.

    const validation = settingsSchema.partial().safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    let existing;
    if (profileId) {
        existing = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
    } else {
        existing = await db.select().from(profiles).limit(1);
    }

    if (existing.length === 0) {
        // Create new if not exists (should have been handled by GET ideally, or implicit creation here)
        const newProfile = {
             id: crypto.randomUUID(),
             name: "Default",
             createdAt: new Date().toISOString(),
             ...body
        };
        await db.insert(profiles).values(newProfile);
        return NextResponse.json({ success: true, id: newProfile.id });
    } else {
        const idToUpdate = existing[0].id;
        await db.update(profiles).set(body).where(eq(profiles.id, idToUpdate));
        return NextResponse.json({ success: true, id: idToUpdate });
    }

  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
