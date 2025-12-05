
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq, ne } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
        // Set all profiles to isSelected = false
        await tx.update(profiles).set({ isSelected: false });

        // Set the target profile to isSelected = true
        await tx.update(profiles).set({ isSelected: true }).where(eq(profiles.id, id));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error selecting profile:', error);
    return NextResponse.json({ error: 'Failed to select profile' }, { status: 500 });
  }
}
