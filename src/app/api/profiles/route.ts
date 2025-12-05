
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, settings } from '@/lib/db/schema';
import { eq, ne } from 'drizzle-orm';
import { z } from 'zod';

const createProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export async function GET() {
  try {
    const allProfiles = await db.select().from(profiles).orderBy(profiles.createdAt);
    return NextResponse.json(allProfiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

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
        return NextResponse.json({ error: 'Profile with this name already exists' }, { status: 409 });
    }

    const newProfileId = crypto.randomUUID();
    const newProfile = {
        id: newProfileId,
        name,
        isSelected: true, // Auto-select new profile? Or let user switch manually?
        // If we select it, we must deselect others.
        // Let's NOT auto-select for now to keep it simple, or maybe we should?
        // "When app starts, we should have a 'default' profile ready... User can rename... create... make sure at least one is kept and selected"
        // Usually creating a new profile doesn't automatically switch to it unless requested.
        // Let's assume false for now.
        isSelected: false,
        createdAt: new Date().toISOString(),
    };

    await db.insert(profiles).values(newProfile);

    // Also create default settings for this profile
    await db.insert(settings).values({
        // id will be auto-incremented or we should probably not rely on it being 1 anymore.
        // But wait, schema says id is primary key integer.
        // I need to let it auto-increment.
        profileId: newProfileId,
        // Default values will be used for other fields
    });

    return NextResponse.json(newProfile);
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
