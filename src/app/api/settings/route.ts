
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

    // Validate or sanitize input if necessary
    // For now, we assume the body matches the schema

    const newSettings = {
        id: 1, // Ensure we are updating the singleton row
        idlePollInterval: body.idlePollInterval,
        activePollInterval: body.activePollInterval,
        titleTruncateLength: body.titleTruncateLength,
        lineClamp: body.lineClamp,
        sessionItemsPerPage: body.sessionItemsPerPage,
        jobsPerPage: body.jobsPerPage,
        defaultSessionCount: body.defaultSessionCount,
        prStatusPollInterval: body.prStatusPollInterval,
        theme: body.theme,
        autoApprovalInterval: body.autoApprovalInterval,
    }

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
