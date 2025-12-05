
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Helper function to ensure default profile exists
async function ensureDefaultProfile() {
  const allProfiles = await db.select().from(profiles).all();
  if (allProfiles.length === 0) {
    const newProfile = await db.insert(profiles).values({ name: 'Default', isActive: true }).returning();
    const newSettings = {
      profileId: newProfile[0].id,
      // All other settings will use their default values from the schema
    };
    await db.insert(settings).values(newSettings);
    return newProfile[0];
  }
  return allProfiles.find(p => p.isActive) || allProfiles[0];
}

export async function GET() {
  try {
    await ensureDefaultProfile();
    const allProfiles = await db.select().from(profiles).all();
    return NextResponse.json(allProfiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Profile name is required' }, { status: 400 });
    }

    const newProfile = await db.insert(profiles).values({ name, isActive: false }).returning();

    // Create settings for the new profile
    const newSettings = {
        profileId: newProfile[0].id,
    };
    await db.insert(settings).values(newSettings);

    return NextResponse.json(newProfile[0]);
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
