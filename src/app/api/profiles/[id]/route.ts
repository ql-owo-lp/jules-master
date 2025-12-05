
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { and } from 'drizzle-orm';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json();
    const { name, isActive } = body;

    if (isActive) {
      // Set all other profiles to inactive
      await db.update(profiles).set({ isActive: false }).where(eq(profiles.isActive, true));
    }

    const updatedProfile = await db.update(profiles).set({ name, isActive }).where(eq(profiles.id, id)).returning();

    return NextResponse.json(updatedProfile[0]);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10);

    // Ensure there's at least one profile remaining
    const allProfiles = await db.select().from(profiles).all();
    if (allProfiles.length <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last profile' }, { status: 400 });
    }

    await db.delete(profiles).where(eq(profiles.id, id));

    // If the deleted profile was active, set another to active
    const activeProfile = await db.select().from(profiles).where(eq(profiles.isActive, true)).all();
    if (activeProfile.length === 0) {
        const firstProfile = await db.select().from(profiles).limit(1).all();
        await db.update(profiles).set({ isActive: true }).where(eq(profiles.id, firstProfile[0].id));
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting profile:', error);
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
  }
}
