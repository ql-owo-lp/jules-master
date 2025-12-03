
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { settingsSchema } from '@/lib/validation';

export async function GET() {
  try {
    const result = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);

    if (result.length === 0) {
      // Return default settings if none exist in DB
      return NextResponse.json({
        idlePollInterval: 120,
        activePollInterval: 30,
        titleTruncateLength: 50,
        lineClamp: 1,
        sessionItemsPerPage: 10,
        jobsPerPage: 5,
        defaultSessionCount: 10,
        prStatusPollInterval: 60,
        theme: 'system',
        autoApprovalInterval: 60,
        autoRetryEnabled: true,
        autoRetryMessage: "You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution",
        autoContinueEnabled: true,
        autoContinueMessage: "Sounds good. Now go ahead finish the work",
        sessionCacheInProgressInterval: 60,
        sessionCacheCompletedNoPrInterval: 1800,
        sessionCachePendingApprovalInterval: 300,
        sessionCacheMaxAgeDays: 3,
      });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = settingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    const newSettings = {
      id: 1, // Ensure we are updating the singleton row
      ...validation.data,
    };

    const existing = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);

    if (existing.length > 0) {
        await db.update(settings).set(newSettings).where(eq(settings.id, 1));
    } else {
        await db.insert(settings).values(newSettings);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
