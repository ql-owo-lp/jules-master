
import { NextResponse } from 'next/server';
import { profileService } from '@/lib/db/profile-service';

export async function GET() {
  try {
    const profiles = await profileService.getAllProfiles();
    return NextResponse.json(profiles);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const newProfile = await profileService.createProfile(name);
    return NextResponse.json(newProfile);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
