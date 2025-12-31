
import { NextResponse } from 'next/server';
import { updateCronJob, deleteCronJob, toggleCronJob } from '@/app/settings/actions';
import { cronJobSchema } from '@/lib/validation';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();

    // Handle enabled separately as it's not in the main schema
    if (data.hasOwnProperty('enabled')) {
      if (typeof data.enabled === 'boolean') {
        await toggleCronJob(id, data.enabled);
      }
    }

    // Validate using partial schema for updates
    // partial() makes all fields optional. safeParse() strips unknown keys by default.
    const validation = cronJobSchema.partial().safeParse(data);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.formErrors.fieldErrors }, { status: 400 });
    }

    // Only update if there are valid fields to update
    if (Object.keys(validation.data).length > 0) {
        await updateCronJob(id, validation.data);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update cron job' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteCronJob(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete cron job' }, { status: 500 });
  }
}
