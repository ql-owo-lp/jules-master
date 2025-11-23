
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jobs, settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Jules } from '@jules/sdk';

export async function GET() {
  try {
    const appSettings = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);

    if (appSettings.length === 0 || !appSettings[0].autoRetryEnabled) {
      return NextResponse.json({ message: 'Auto retry is disabled' });
    }

    const { autoRetryMessage } = appSettings[0];
    const jules = new Jules();

    const failedJobs = await db.select().from(jobs).where(eq(jobs.status, 'Failed'));

    const promises = failedJobs.flatMap(job =>
      job.sessionIds.map(sessionId =>
        jules.sessions.sendMessage({
          sessionId,
          message: {
            message: {
              userMessage: {
                message: autoRetryMessage,
              },
            },
          },
        })
      )
    );

    await Promise.all(promises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in auto-retry cron job:', error);
    return NextResponse.json({ error: 'Failed to run auto-retry cron job' }, { status: 500 });
  }
}
