
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
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

        // Run cron worker every minute
        setInterval(processCronJobs, 60 * 1000);
    }
}
