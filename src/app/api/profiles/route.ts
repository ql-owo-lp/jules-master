
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { ensureDefaultProfile } from '@/lib/profile-utils';

export async function GET() {
  try {
    await ensureDefaultProfile();
    const allProfiles = await db.select().from(profiles).orderBy(profiles.createdAt);
    return NextResponse.json(allProfiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

// ... POST remains same
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { settings } from '@/lib/db/schema';

const createProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = createProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    const { name } = validation.data;

    const existing = await db.select().from(profiles).where(eq(profiles.name, name)).limit(1);
    if (existing.length > 0) {
        return NextResponse.json({ error: 'Profile with this name already exists' }, { status: 400 });
    }

    const newProfileId = crypto.randomUUID();
    const newProfile = {
        id: newProfileId,
        name,
        isSelected: false, // Default to false, user must select it explicitly or we can auto-select? Let's stay false.
        createdAt: new Date().toISOString(),
    };

    await db.insert(profiles).values(newProfile);

    // Also create a default settings row for this profile
    // We can copy from "Default" profile or use hardcoded defaults.
    // Let's use hardcoded defaults which are same as in settings route GET.

    // Actually, let's fetch the currently selected profile's settings and clone them?
    // That's a good user experience: "Clone current settings".
    // But for now, let's just create default settings.

    await db.insert(settings).values({
        // id will be auto-generated if we didn't specify it? Wait, schema has `id: integer('id').primaryKey()`.
        // SQLite integer primary key is auto-increment alias for ROWID.
        // So we don't need to specify it.
        profileId: newProfileId,
        idlePollInterval: 120,
        activePollInterval: 30,
        titleTruncateLength: 50,
        lineClamp: 1,
        sessionItemsPerPage: 10,
        jobsPerPage: 5,
        defaultSessionCount: 10,
        prStatusPollInterval: 60,
        theme: 'system',
        historyPromptsCount: 10,
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
    });

    return NextResponse.json(newProfile);
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
