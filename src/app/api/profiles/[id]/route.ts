
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, settings } from '@/lib/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    const { name } = validation.data;

    // Check if name exists for other profiles
    const existing = await db.select().from(profiles).where(and(eq(profiles.name, name), ne(profiles.id, id)));
    if (existing.length > 0) {
      return NextResponse.json({ error: "Profile name already exists" }, { status: 400 });
    }

    await db.update(profiles).set({ name }).where(eq(profiles.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // Check if profile exists
        const profile = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
        if (profile.length === 0) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        if (profile[0].isSelected) {
             return NextResponse.json({ error: "Cannot delete the currently selected profile. Switch to another profile first." }, { status: 400 });
        }

        // Count profiles
        const allProfiles = await db.select().from(profiles);
        if (allProfiles.length <= 1) {
            return NextResponse.json({ error: "Cannot delete the last profile." }, { status: 400 });
        }

        // Delete profile. Settings should be deleted via cascade, but we can also delete manually if needed.
        // In schema: `profileId: text('profile_id').references(() => profiles.id, { onDelete: 'cascade' })`
        // So cascading delete should work.

        await db.delete(profiles).where(eq(profiles.id, id));

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting profile:', error);
        return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
    }
}
