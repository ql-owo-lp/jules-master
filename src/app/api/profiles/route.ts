
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    let allProfiles = await db.select().from(profiles).all();

    if (allProfiles.length === 0) {
        // Create default profile
        const defaultProfile = {
            id: crypto.randomUUID(),
            name: "Default",
            createdAt: new Date().toISOString(),
            idlePollInterval: 120,
            activePollInterval: 30,
            sessionCacheInProgressInterval: 60,
            sessionCacheCompletedNoPrInterval: 1800,
            sessionCachePendingApprovalInterval: 300,
            sessionCacheMaxAgeDays: 3,
            autoDeleteStaleBranches: false,
            autoDeleteStaleBranchesAfterDays: 3,
            historyPromptsCount: 10,
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
        };
        await db.insert(profiles).values(defaultProfile);
        allProfiles = [defaultProfile];
    }

    return NextResponse.json(allProfiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newProfile = {
      ...body,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    // Ensure name is present
    if (!newProfile.name) {
        newProfile.name = "New Profile";
    }

    await db.insert(profiles).values(newProfile);
    return NextResponse.json(newProfile);
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
