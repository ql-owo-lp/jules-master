
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, settings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    const { name } = validation.data;

    await db.update(profiles).set({ name }).where(eq(profiles.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params;

    // Check if it's the selected profile
    const profile = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    if (profile.length > 0 && profile[0].isSelected) {
        return NextResponse.json({ error: 'Cannot delete the currently selected profile.' }, { status: 400 });
    }

    // Check if it's the last profile (though "selected check" might cover it, better safe)
    const allProfiles = await db.select().from(profiles);
    if (allProfiles.length <= 1) {
         return NextResponse.json({ error: 'Cannot delete the last profile.' }, { status: 400 });
    }

    await db.delete(profiles).where(eq(profiles.id, id));
    // Settings should be deleted by cascade, but let's ensure
    // In Drizzle/SQLite, cascade works if foreign keys are enabled.
    // If not, we should manually delete settings.
    // The schema definition has `onDelete: 'cascade'`, but we need to ensure PRAGMA foreign_keys = ON;
    // For safety, let's delete settings manually too if needed, but Drizzle usually handles or we can just trust it.
    // Let's rely on cascade for now, or manually delete to be safe.
    await db.delete(settings).where(eq(settings.profileId, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting profile:', error);
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
  }
}
