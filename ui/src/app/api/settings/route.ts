
import { NextResponse } from 'next/server';
import { settingsClient } from '@/lib/grpc-client';
import { settingsSchema } from '@/lib/validation';
import { Settings } from '@/proto/jules';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId') || 'default';

    const settings = await new Promise<Settings>((resolve, reject) => {
        console.log(`[API] gRPC GET getSettings for ${profileId}...`);
        if (process.env.MOCK_API === 'true') {
            console.log(`[API] Returning MOCK settings`);
            return resolve({
                id: 'mock',
                defaultSessionCount: 20,
                idlePollInterval: 120,
                activePollInterval: 30,
                historyPromptsCount: 10,
                autoDeleteStaleBranches: false,
                autoApprovalInterval: 60,
                titleTruncateLength: 50,
                lineClamp: 3,
                sessionItemsPerPage: 10,
                maxConcurrentBackgroundWorkers: 10,
                profileId: profileId,
                closePrOnConflictEnabled: false
            } as unknown as Settings);
        }

        const timeout = setTimeout(() => {
            console.error(`[API] gRPC GET getSettings TIMEOUT for ${profileId}`);
            reject(new Error('gRPC timeout'));
        }, 5000);

        settingsClient.getSettings({ profileId }, (err, res) => {
            clearTimeout(timeout);
            if (err) {
                console.error(`[API] gRPC GET getSettings ERROR:`, err);
                return reject(err);
            }
            console.log(`[API] gRPC GET getSettings SUCCESS`);
            resolve(res);
        });
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'At least one setting must be provided.' }, { status: 400 });
    }

    const validation = settingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const profileId = validation.data.profileId || 'default';

    // Map validation data to Settings proto
    // validation.data has fields matching Settings interface roughly
    // Types might need casting or mapping
    const newSettings = {
      ...validation.data,
      profileId,
      id: '0' // Default ID for proto
    } as unknown as Settings;
    
    // Proto Settings has specific types.
    // validation.data comes from zod which enforces types.
    
    await new Promise<void>((resolve, reject) => {
        console.log(`[API] gRPC POST updateSettings for ${profileId}...`);
        if (process.env.MOCK_API === 'true') {
            console.log(`[API] Returning MOCK success`);
            return resolve();
        }

        const timeout = setTimeout(() => {
            console.error(`[API] gRPC POST updateSettings TIMEOUT for ${profileId}`);
            reject(new Error('gRPC timeout'));
        }, 5000);

        settingsClient.updateSettings({ settings: newSettings }, (err) => {
            clearTimeout(timeout);
            if (err) {
                console.error(`[API] gRPC POST updateSettings ERROR:`, err);
                return reject(err);
            }
            console.log(`[API] gRPC POST updateSettings SUCCESS`);
            resolve();
        });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
