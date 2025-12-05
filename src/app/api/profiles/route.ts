
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, settings } from '@/lib/db/schema';
import { eq, ne } from 'drizzle-orm';
import { z } from 'zod';

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

// Helper to ensure at least one profile exists (Duplicated from settings/route.ts or shared lib?)
// Better to share logic, but for now duplicate to keep it self-contained in this route too if accessed directly.
// But actually GET /api/profiles is likely called first by UI.
async function ensureDefaultProfile() {
    const allProfiles = await db.select().from(profiles).limit(1);
    if (allProfiles.length === 0) {
        console.log("No profiles found (in profiles route). Creating Default profile and migrating settings...");
        const defaultProfileId = crypto.randomUUID();
        const now = new Date().toISOString();

        await db.insert(profiles).values({
            id: defaultProfileId,
            name: 'Default',
            isSelected: true,
            createdAt: now,
        });

        // Link existing settings
        const existingSettings = await db.select().from(settings).limit(1);
        if (existingSettings.length > 0) {
             await db.update(settings)
                .set({ profileId: defaultProfileId })
                .where(eq(settings.id, 1));
        } else {
             await db.insert(settings).values({
                 profileId: defaultProfileId,
                 theme: 'system',
             });
        }
    }
}

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = profileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    const { name } = validation.data;

    // Check unique name
    // (Drizzle unique constraint throws error, but nice to check here too for better error msg)
    const existing = await db.select().from(profiles).where(eq(profiles.name, name)).limit(1);
    if (existing.length > 0) {
        return NextResponse.json({ error: { name: 'Profile name already exists.' } }, { status: 400 });
    }

    const newProfileId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(profiles).values({
      id: newProfileId,
      name,
      isSelected: false,
      createdAt: now,
    });

    // Create default settings for the new profile
    await db.insert(settings).values({
       profileId: newProfileId,
       theme: 'system',
       // other defaults are handled by schema default values
    });

    return NextResponse.json({ success: true, id: newProfileId });
  } catch (error) {
    console.error('Error creating profile:', error);
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
         return NextResponse.json({ error: { name: 'Profile name already exists.' } }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
