
import { NextResponse } from 'next/server';
import { triggerCronJob } from '@/app/settings/actions';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await triggerCronJob(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to execute cron job", error);
    return NextResponse.json({ error: 'Failed to execute cron job' }, { status: 500 });
  }
}
