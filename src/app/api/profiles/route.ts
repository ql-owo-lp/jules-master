
import { NextResponse } from 'next/server';
import {
    getAllProfiles,
    createProfile,
    setActiveProfile,
    updateProfile,
    deleteProfile,
    ensureDefaultProfile
} from '@/lib/profile-service';

export async function GET() {
    await ensureDefaultProfile();
    const profiles = await getAllProfiles();
    return NextResponse.json(profiles);
}

export async function POST(req: Request) {
    const body = await req.json();
    const { action, id, name, ...data } = body;

    try {
        if (action === 'create') {
            const newProfile = await createProfile(name);
            return NextResponse.json(newProfile);
        } else if (action === 'set_active') {
            await setActiveProfile(id);
            return NextResponse.json({ success: true });
        } else if (action === 'update') {
            await updateProfile(id, data);
            return NextResponse.json({ success: true });
        } else if (action === 'delete') {
            await deleteProfile(id);
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
