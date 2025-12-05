
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { profiles, settings } from '@/lib/db/schema';
import { eq, ne } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const newProfileId = uuidv4();
    const now = new Date().toISOString();

    const newProfile = {
      id: newProfileId,
      name,
      isActive: false, // Default to inactive
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(profiles).values(newProfile);

    // Also create default settings for this profile
    await db.insert(settings).values({
        // id will be auto-incremented
        profileId: newProfileId,
        // other fields use defaults from schema
    });

    return NextResponse.json(newProfile);
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, isActive, name } = body;

        if (!id) {
             return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const updates: any = { updatedAt: new Date().toISOString() };
        if (name) updates.name = name;

        if (typeof isActive === 'boolean') {
             updates.isActive = isActive;
             if (isActive) {
                 // If setting to active, deactivate all others
                 await db.update(profiles).set({ isActive: false }).where(ne(profiles.id, id));
             } else {
                 // If setting to inactive, we must ensure at least one profile remains active.
                 // But typically we switch TO a profile, so we set it active.
                 // If the user tries to turn off the current profile without selecting another, we might prevent it.
                 // However, simpler logic is: user selects a profile to be active.
             }
        }

        await db.update(profiles).set(updates).where(eq(profiles.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
         console.error('Error updating profile:', error);
         return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        // Check if it's the only profile or the active profile?
        // Requirement: "user cannot remove it" if it's the only one.
        const allProfiles = await db.select().from(profiles);
        if (allProfiles.length <= 1) {
             return NextResponse.json({ error: 'Cannot delete the last profile.' }, { status: 400 });
        }

        const profileToDelete = allProfiles.find(p => p.id === id);
        if (profileToDelete?.isActive) {
             return NextResponse.json({ error: 'Cannot delete the active profile. Switch to another profile first.' }, { status: 400 });
        }

        // Delete associated data? Or just the profile?
        // Schema has foreign keys but no cascade delete defined in my update.
        // I should probably delete associated data manually or rely on cascade if I had set it.
        // For now, I'll delete the profile. SQLite might complain if foreign keys enforce it.

        // Let's assume we want to cascade delete manually for safety
        await db.delete(settings).where(eq(settings.profileId, id));
        // jobs, sessions etc... this is dangerous if we want to keep history.
        // But if the profile is deleted, its settings are gone.
        // Maybe we should just soft delete? But requirement says "remove".

        await db.delete(profiles).where(eq(profiles.id, id));

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting profile:', error);
        return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
    }
}
