
import { NextResponse } from 'next/server';
import { profileService } from '@/lib/db/profile-service';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    await profileService.updateProfile(params.id, { name });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await profileService.deleteProfile(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to delete profile' }, { status: 500 });
  }
}
