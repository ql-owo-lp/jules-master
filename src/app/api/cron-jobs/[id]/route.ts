
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = { ...validation.data };
        if (updateData.automationMode) {
            // Map string 'AUTO_CREATE_PR' etc to Enum
            // Assuming strict mapping based on Proto Enum names
            // If it's already a number this might fail, but validation.data comes from Zod schema likely string?
            // Actually schema should match Local type string.
            // Proto expects Enum (number).
            // But actions.ts updateCronJob signature expects Partial<CronJob> which uses keys.
            // Wait, Proto CronJob interface has `automationMode: AutomationMode` (Enum).
            // So we must pass Enum.
            // Import AutomationMode from proto.
            // I need to import AutomationMode in this file first?
            // Or just use cast if I know the value?
            // Better to import it.
             if (updateData.automationMode === 'AUTO_CREATE_PR') {
                 updateData.automationMode = 1; // AutomationMode.AUTO_CREATE_PR
             } else {
                 updateData.automationMode = 0; // UNSPECIFIED
             }
        }
        await updateCronJob(id, updateData);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update cron job' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteCronJob(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete cron job' }, { status: 500 });
  }
}
