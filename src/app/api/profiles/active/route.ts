
import { NextResponse } from 'next/server';
import { profileService } from '@/lib/db/profile-service';

export async function GET() {
  try {
    const activeProfile = await profileService.getActiveProfile();
    return NextResponse.json(activeProfile);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch active profile' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }
    await profileService.setActiveProfile(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to set active profile' }, { status: 500 });
  }
}
