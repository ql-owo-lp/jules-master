
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, settings } from '@/lib/db/schema';
import { desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';

const createProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export async function GET() {
  try {
    const allProfiles = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
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
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    // Check if name exists
    const existing = await db.select().from(profiles).where(eq(profiles.name, name));
    if (existing.length > 0) {
      return NextResponse.json({ error: "Profile name already exists" }, { status: 400 });
    }

    // Determine if this is the first profile (should be selected)
    // Actually, migration guarantees one profile. But if user adds one, it won't be selected by default unless we decide so.
    // Let's create it as not selected.

    await db.insert(profiles).values({
      id,
      name,
      isSelected: false,
      createdAt
    });

    // Create default settings for this profile
    // We can copy from default values in schema or clone current settings?
    // Let's use default values as defined in schema (by not providing them in insert, except required ones)
    // The settings table columns have defaults. `id` is PK auto-increment.

    await db.insert(settings).values({
        profileId: id,
        // all other fields will take default values
    });

    return NextResponse.json({ id, name, isSelected: false, createdAt });
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
