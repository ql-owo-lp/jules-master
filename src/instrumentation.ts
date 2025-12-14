
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initLogger } = await import('./lib/logger');
        initLogger();

        const { startAutoApprovalWorker } = await import('./lib/auto-approval-worker');
        const { startAutoRetryWorker } = await import('./lib/auto-retry-worker');
        const { startAutoContinueWorker } = await import('./lib/auto-continue-worker');
        const { startAutoDeleteStaleBranchWorker } = await import('./lib/auto-delete-stale-branch-worker');
        const { startBackgroundJobWorker } = await import('./lib/background-job-worker');
        const { processCronJobs } = await import('./lib/cron-worker');

        startAutoApprovalWorker();
        startAutoRetryWorker();
        startAutoContinueWorker();
        startAutoDeleteStaleBranchWorker();
        startBackgroundJobWorker();

        // Initialize settings if needed
        const { db } = await import('./lib/db');
        const { settings, profiles } = await import('./lib/db/schema');
        const { eq } = await import('drizzle-orm');

        try {
            // Ensure default profile exists
            const existingProfile = await db.select().from(profiles).where(eq(profiles.id, 'default')).limit(1);
            if (existingProfile.length === 0) {
                console.log('Seeding default profile...');
                await db.insert(profiles).values({
                    id: 'default',
                    name: 'Default',
                    createdAt: new Date().toISOString()
                });
            }

            const existingSettings = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
            if (existingSettings.length === 0) {
                console.log('Seeding default settings...');
                await db.insert(settings).values({ id: 1, autoApprovalEnabled: true });
            }
        } catch (error) {
            console.error('Failed to seed settings:', error);
        }

        // Run cron worker every minute
        setInterval(processCronJobs, 60 * 1000);

        setInterval(() => {
            const used = process.memoryUsage();
            console.log(`[MEMORY] RSS: ${(used.rss / 1024 / 1024).toFixed(2)} MB, Heap: ${(used.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        }, 5000);

        const shutdown = (signal: string) => {
            console.log(`Received ${signal}. Shutting down...`);
            console.log(`[MEMORY FINAL] RSS: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`);
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
}
