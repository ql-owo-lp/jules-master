
'use server';

import { enqueueJob, getQueueStatus } from '@/lib/background-job-worker';
import { revalidateSessions } from '@/app/sessions/actions';
import { addJob } from '@/app/config/actions';
import type { Job, AutomationMode, Source } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function createBackgroundJob(
    title: string,
    prompt: string,
    source: Source,
    branch: string,
    requirePlanApproval: boolean,
    automationMode: AutomationMode,
    apiKey: string,
    jobId: string
) {
    const backgroundJobId = await enqueueJob({
        type: 'CREATE_SESSION',
        data: {
            title,
            prompt,
            source,
            branch,
            requirePlanApproval,
            automationMode,
            apiKey,
            jobId
        }
    });

    // We can't easily revalidate the queue status UI since it's client-side polling or a new server component.
    // But we can revalidate the jobs list.
    revalidatePath('/');
    return backgroundJobId;
}

export async function getBackgroundQueueStatus() {
    return getQueueStatus();
}
