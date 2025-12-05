
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { settingsSchema } from '@/lib/validation';
import { profileService } from '@/lib/db/profile-service';

export async function GET(request: Request) {
  try {
    const activeProfile = await profileService.getActiveProfile();
    const result = await db.select().from(settings).where(eq(settings.profileId, activeProfile.id)).limit(1);

    if (result.length === 0) {
      // Create default settings if none exist
      await db.insert(settings).values({
        profileId: activeProfile.id
      });
      const newSettings = await db.select().from(settings).where(eq(settings.profileId, activeProfile.id)).limit(1);
      return NextResponse.json(newSettings[0]);
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

    const activeProfile = await profileService.getActiveProfile();
    const existing = await db.select().from(settings).where(eq(settings.profileId, activeProfile.id)).limit(1);

    if (existing.length > 0) {
        await db.update(settings).set(validation.data).where(eq(settings.id, existing[0].id));
    } else {
        await db.insert(settings).values({
            ...validation.data,
            profileId: activeProfile.id
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
