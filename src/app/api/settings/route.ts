
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { settingsSchema } from '@/lib/validation';

import { profiles } from '@/lib/db/schema';

async function getActiveProfile() {
  let activeProfile = await db.select().from(profiles).where(eq(profiles.isActive, true)).limit(1);
  if (activeProfile.length === 0) {
    const allProfiles = await db.select().from(profiles).all();
    if (allProfiles.length === 0) {
        // First run, create default profile
        const newProfile = await db.insert(profiles).values({ name: 'Default', isActive: true }).returning();
        const newSettings = { profileId: newProfile[0].id };
        await db.insert(settings).values(newSettings);
        return newProfile[0];
    }
    // No active profile, make the first one active
    await db.update(profiles).set({ isActive: true }).where(eq(profiles.id, allProfiles[0].id));
    return allProfiles[0];
  }
  return activeProfile[0];
}


export async function GET() {
  try {
    const activeProfile = await getActiveProfile();
    const result = await db.select().from(settings).where(eq(settings.profileId, activeProfile.id)).limit(1);

    // There will always be settings for a profile, so no need to check for empty result
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

    const activeProfile = await getActiveProfile();

    await db.update(settings).set(validation.data).where(eq(settings.profileId, activeProfile.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
