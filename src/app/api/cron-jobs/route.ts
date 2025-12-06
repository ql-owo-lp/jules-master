
import { NextResponse } from 'next/server';
import { getCronJobs, createCronJob } from '@/app/settings/actions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cronJobs = await getCronJobs();
    return NextResponse.json(cronJobs);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch cron jobs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const newCronJob = await createCronJob(data);
    return NextResponse.json(newCronJob);
  } catch {
    return NextResponse.json({ error: 'Failed to create cron job' }, { status: 500 });
  }
}
