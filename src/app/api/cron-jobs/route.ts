
import { NextResponse } from 'next/server';
import { getCronJobs, createCronJob } from '@/app/settings/actions';
import { cronJobSchema } from '@/lib/validation';

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
    const validation = cronJobSchema.safeParse(data);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newCronJob = await createCronJob(validation.data as unknown as any); // Cast as any because schema doesn't include all internal fields but matches required inputs
    return NextResponse.json(newCronJob);
  } catch {
    return NextResponse.json({ error: 'Failed to create cron job' }, { status: 500 });
  }
}
