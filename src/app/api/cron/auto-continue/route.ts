
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jobs, settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Jules } from '@jules/sdk';

export async function GET() {
  try {
    const appSettings = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);

    if (appSettings.length === 0 || !appSettings[0].autoContinueEnabled) {
      return NextResponse.json({ message: 'Auto continue is disabled' });
    }

    const { autoContinueMessage } = appSettings[0];
    const jules = new Jules();

    const completedJobs = await db.select().from(jobs).where(eq(jobs.status, 'Completed'));

    const promises = completedJobs.flatMap(job =>
      job.sessionIds.map(async sessionId => {
        const session = await jules.sessions.get({ sessionId });
        if (session.outputs?.every(output => !output.pullRequest)) {
          await jules.sessions.sendMessage({
            sessionId,
            message: {
              message: {
                userMessage: {
                  message: autoContinueMessage,
                },
              },
            },
          });
        }
      })
    );

    await Promise.all(promises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in auto-continue cron job:', error);
    return NextResponse.json({ error: 'Failed to run auto-continue cron job' }, { status: 500 });
  }
}
