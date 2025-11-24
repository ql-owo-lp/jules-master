
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startAutoApprovalWorker } = await import('./lib/auto-approval-worker');
        startAutoApprovalWorker();
        const { startAutoRetryWorker } = await import('./lib/auto-retry-worker');
        startAutoRetryWorker();
        const { startAutoContinueWorker } = await import('./lib/auto-continue-worker');
        startAutoContinueWorker();
    }
}
