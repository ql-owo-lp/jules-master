
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startAutoApprovalWorker } = await import('./lib/auto-approval-worker');
        const { startAutomationWorker } = await import('./lib/automation-worker');
        startAutoApprovalWorker();
        startAutomationWorker({
            name: 'AutoRetryWorker',
            settingEnabled: 'autoRetry',
            intervalSetting: 'autoRetryInterval',
            messageSetting: 'autoRetryMessage',
            sessionState: 'SESSION_STATE_FAILED',
            checkPullRequest: false,
        });
        startAutomationWorker({
            name: 'AutoContinueWorker',
            settingEnabled: 'autoContinue',
            intervalSetting: 'autoContinueInterval',
            messageSetting: 'autoContinueMessage',
            sessionState: 'SESSION_STATE_COMPLETED',
            checkPullRequest: true,
        });
    }
}
