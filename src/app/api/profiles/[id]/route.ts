
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const profile = await db.select().from(profiles).where(eq(profiles.id, id)).get();
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (error) {
    console.error(`Error fetching profile ${id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();

    // Validate or clean body if necessary. For now, assuming body matches schema subset.
    // Prevent updating ID or createdAt if passed
    delete body.id;
    delete body.createdAt;

    await db.update(profiles).set(body).where(eq(profiles.id, id));

    const updatedProfile = await db.select().from(profiles).where(eq(profiles.id, id)).get();
    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error(`Error updating profile ${id}:`, error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    // Check if it's the last profile? Or maybe prevent deleting the "default" one if we have such concept.
    // For now, allow deletion.
    await db.delete(profiles).where(eq(profiles.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
     console.error(`Error deleting profile ${id}:`, error);
     return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
  }
}
