
import { createWorker } from "./lib/worker-creator";

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startAutoApprovalWorker } = await import('./lib/auto-approval-worker');
        startAutoApprovalWorker();

        const autoRetryWorker = createWorker({
            workerName: "AutoRetryWorker",
            enabledSetting: "autoRetryEnabled",
            intervalSetting: "autoRetryInterval",
            messageSetting: "autoRetryMessage",
            sessionState: "FAILED",
            getMessage: (settings) => settings.autoRetryMessage,
        });
        autoRetryWorker.start();

        const autoContinueWorker = createWorker({
            workerName: "AutoContinueWorker",
            enabledSetting: "autoContinueEnabled",
            intervalSetting: "autoContinueInterval",
            messageSetting: "autoContinueMessage",
            sessionState: "COMPLETED",
            customLogic: (session) => !session.outputs || session.outputs.length === 0 || !session.outputs.some(o => o.pullRequest),
            getMessage: (settings) => settings.autoContinueMessage,
        });
        autoContinueWorker.start();
    }
}
