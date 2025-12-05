
import { NextResponse } from 'next/server';
import { getCronJobs, createCronJob } from '@/app/settings/actions';

<<<<<<< HEAD
export const dynamic = 'force-dynamic';

export async function GET() {
=======
export async function GET(request: Request) {
>>>>>>> 4d52d8a (Apply patch /tmp/a95fca6f-c2d6-4225-a184-e2348dbb7295.patch)
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('profileId') || undefined;
    const cronJobs = await getCronJobs(profileId);
    return NextResponse.json(cronJobs);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cron jobs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    // Assuming data includes profileId if needed
    const newCronJob = await createCronJob(data);
    return NextResponse.json(newCronJob);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create cron job' }, { status: 500 });
  }
}
