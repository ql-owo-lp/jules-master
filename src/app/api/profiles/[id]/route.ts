import { NextResponse } from 'next/server';
import { profileService } from '@/lib/profile-service';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Profile name is required' }, { status: 400 });
    }

    const updatedProfile = await profileService.updateProfile(id, name);
    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Check if it's the last profile
    const profiles = await profileService.getProfiles();
    if (profiles.length <= 1) {
         return NextResponse.json({ error: 'Cannot delete the last profile' }, { status: 400 });
    }

    // Also prevent deleting 'default' profile if we want to enforce it,
    // but the requirement says "user cannot remove it" referring to "at least one profile is kept".
    // It doesn't explicitly say "default" profile is immutable.
    // But usually default profiles are protected.
    // Let's just stick to "at least one profile is kept".

    await profileService.deleteProfile(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting profile:', error);
    return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
  }
}
