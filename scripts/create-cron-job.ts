
import { createCronJob } from '@/app/settings/actions';
import { db } from '@/lib/db';
import { cronJobs } from '@/lib/db/schema';

async function main() {
    console.log("Creating test cron job...");
    await createCronJob({
        name: 'Test Cron Job',
        schedule: '* * * * *',
        prompt: 'Test Prompt',
        repo: 'test/repo',
        branch: 'main',
        autoApproval: false,
        automationMode: 'full-auto',
        requirePlanApproval: false,
        sessionCount: 1,
    });
    console.log("Test cron job created.");

    // Verify it was created
    const jobs = await db.select().from(cronJobs);
    console.log("Current cron jobs:", jobs);
}

main().catch(console.error);
