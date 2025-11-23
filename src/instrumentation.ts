
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startAutoApprovalWorker } = await import('./lib/auto-approval-worker');
        startAutoApprovalWorker();
    }
}
