
import { db } from '@/lib/db';
import { profiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const allProfiles = await db.select().from(profiles);
  if (allProfiles.length === 0) {
    // Create a default profile if none exist
    const defaultProfile = {
      id: uuidv4(),
      name: 'Default',
      isActive: true,
      settings: {},
    };
    await db.insert(profiles).values(defaultProfile);
    return NextResponse.json([defaultProfile]);
  }
  return NextResponse.json(allProfiles);
}

export async function POST(request: Request) {
  const { name } = await request.json();
  const newProfile = {
    id: uuidv4(),
    name,
    isActive: false,
    settings: {},
  };
  await db.insert(profiles).values(newProfile);
  return NextResponse.json(newProfile);
}

export async function PUT(request: Request) {
  const { id, name, isActive } = await request.json();

  if (isActive) {
    // Deactivate all other profiles
    await db.update(profiles).set({ isActive: false });
  }

  const updatedProfile = await db
    .update(profiles)
    .set({ name, isActive })
    .where(eq(profiles.id, id))
    .returning();

  return NextResponse.json(updatedProfile[0]);
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  const allProfiles = await db.select().from(profiles);

  if (allProfiles.length <= 1) {
    return new Response('Cannot delete the last profile', { status: 400 });
  }

  await db.delete(profiles).where(eq(profiles.id, id));
  return new Response(null, { status: 204 });
}
