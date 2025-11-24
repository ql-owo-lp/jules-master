
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startAutoApprovalWorker } = await import('./lib/auto-approval-worker');
        const { startAutoRetryWorker } = await import('./lib/auto-retry-worker');
        const { startAutoContinueWorker } = await import('./lib/auto-continue-worker');

        startAutoApprovalWorker();
        startAutoRetryWorker();
        startAutoContinueWorker();
    }
}
