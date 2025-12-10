
import { NextResponse } from 'next/server';
import { profileService } from '@/lib/profile-service';
import { z } from 'zod';

const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  try {
    const profiles = await profileService.getProfiles();
    return NextResponse.json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = createProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    const newProfile = await profileService.createProfile(validation.data.name);
    return NextResponse.json(newProfile);
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
        }

        await profileService.deleteProfile(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting profile:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete profile' }, { status: 500 });
    }
}
