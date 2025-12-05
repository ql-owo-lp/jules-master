
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq, ne } from 'drizzle-orm';
import { z } from 'zod';

const selectProfileSchema = z.object({
  id: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = selectProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    const { id } = validation.data;

    // Verify profile exists
    const profile = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    if (profile.length === 0) {
         return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Unselect all others
    await db.update(profiles).set({ isSelected: false }).where(ne(profiles.id, id));

    // Select this one
    await db.update(profiles).set({ isSelected: true }).where(eq(profiles.id, id));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error selecting profile:', error);
    return NextResponse.json({ error: 'Failed to select profile' }, { status: 500 });
  }
}
