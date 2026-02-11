'use server';

import { jobClient, promptClient, sessionClient, settingsClient } from '@/lib/grpc-client';
import { Job, PredefinedPrompt, HistoryPrompt, AutomationMode, Settings, Session } from '@/proto/jules';
import { Job as LocalJob } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const MOCK_JOBS: LocalJob[] = [];
const MOCK_SETTINGS: Settings = {
    id: 0,
    defaultSessionCount: 20,
    idlePollInterval: 120,
    activePollInterval: 30,
    historyPromptsCount: 10,
    autoDeleteStaleBranches: false,
    autoApprovalInterval: 60,
    titleTruncateLength: 0,
    lineClamp: 0,
    sessionItemsPerPage: 0,
    jobsPerPage: 0,
    prStatusPollInterval: 0,
    theme: '',
    autoApprovalEnabled: false,
    autoRetryEnabled: false,
    autoRetryMessage: '',
    autoContinueEnabled: false,
    autoContinueMessage: '',
    sessionCacheInProgressInterval: 0,
    sessionCacheCompletedNoPrInterval: 0,
    sessionCachePendingApprovalInterval: 0,
    sessionCacheMaxAgeDays: 0,
    autoDeleteStaleBranchesAfterDays: 0,
    checkFailingActionsEnabled: false,
    checkFailingActionsInterval: 0,
    checkFailingActionsThreshold: 0,
    autoCloseStaleConflictedPrs: false,
    staleConflictedPrsDurationDays: 0,
    minSessionInteractionInterval: 0,
    retryTimeout: 0,
    profileId: '',
    maxConcurrentBackgroundWorkers: 0,
    autoApprovalAllSessions: false,
    autoContinueAllSessions: false,
    autoMergeEnabled: false,
    autoMergeMethod: 'squash',
    autoMergeMessage: '',
    autoCloseOnConflictMessage: '',
    closePrOnConflictEnabled: false
};
const MOCK_PREDEFINED_PROMPTS: PredefinedPrompt[] = [
    { id: '1', title: 'Fix Lint', prompt: 'Fix lint errors', profileId: 'default' }
];
const MOCK_QUICK_REPLIES: PredefinedPrompt[] = [
    { id: '1', title: 'LGTM', prompt: 'Looks good to me', profileId: 'default' }
];

// --- Jobs ---
export async function getJobs(profileId: string = 'default'): Promise<LocalJob[]> {
    return new Promise((resolve, reject) => {
        if (process.env.MOCK_API === 'true' && process.env.HYBRID_MOCK !== 'true') {
             return resolve(MOCK_JOBS);
        }
        // ListJobs currently returns all, we might filter by profileId client-side
        // or update backend to support filtering.
        jobClient.listJobs({}, (err, response) => {
            if (err) return reject(err);
            const filtered = response.jobs.filter(j => j.profileId === profileId);
            // Map Proto Job to Local Job (fix enum vs string mismatch)
            // Local Job expects automationMode as string union, Proto has Enum
            const mapped = filtered.map(j => ({
                ...j,
                automationMode: AutomationMode[j.automationMode] as LocalJob['automationMode']
            }));
            resolve(mapped);
        });
    });
}

export async function addJob(job: LocalJob): Promise<void> {
    return new Promise((resolve, reject) => {
        if (process.env.MOCK_API === 'true' && process.env.HYBRID_MOCK !== 'true') {
             return resolve();
        }
        const req = {
            ...job,
            profileId: job.profileId || 'default',
            // Default generated fields handling if missing
            sessionIds: job.sessionIds || [],
            automationMode: job.automationMode === 'AUTO_CREATE_PR' ? AutomationMode.AUTO_CREATE_PR : AutomationMode.AUTOMATION_MODE_UNSPECIFIED,
            autoApproval: job.autoApproval ?? false,
            background: job.background ?? false,
            requirePlanApproval: job.requirePlanApproval ?? false,
            sessionCount: job.sessionCount ?? 0,
            status: job.status ?? 'PENDING',
            cronJobId: job.cronJobId || '',
            prompt: job.prompt || '',
            chatEnabled: job.chatEnabled || false
        };
        jobClient.createJob(req, (err) => {
            if (err) return reject(err);
            revalidatePath('/jobs');
            revalidatePath('/');
            resolve();
        });
    });
}

export async function getPendingBackgroundWorkCount(profileId: string = 'default'): Promise<{ pendingJobs: number, retryingSessions: number }> {
    if (process.env.MOCK_API === 'true' && process.env.HYBRID_MOCK !== 'true') {
        return { pendingJobs: 0, retryingSessions: 0 };
    }
    // Fetch all jobs and sessions and filter.
    // Ideally backend should provide this.
    try {
        const jobsPromise = new Promise<Job[]>((resolve, reject) => {
             jobClient.listJobs({}, (err, res) => err ? reject(err) : resolve(res.jobs));
        });
        const sessionsPromise = new Promise<Session[]>((resolve, reject) => {
             sessionClient.listSessions({ profileId }, (err, res) => err ? reject(err) : resolve(res.sessions));
        });

        const [jobs, sessions] = await Promise.all([jobsPromise, sessionsPromise]);

        const pendingJobs = jobs.filter(j => 
            j.profileId === profileId && 
            (j.status === 'PENDING' || j.status === 'PROCESSING')
        ).length;

        let retryingSessions = 0;
        for (const session of sessions) {
             if (session.profileId === profileId && session.state === 'FAILED') {
                 const errorReason = session.lastError || "";
                 const isRateLimit = errorReason.toLowerCase().includes("too many requests") || errorReason.includes("429");
                 const maxRetries = isRateLimit ? 50 : 3;
                 if ((session.retryCount || 0) < maxRetries) {
                     retryingSessions++;
                 }
             }
        }
        
        return { pendingJobs, retryingSessions };

    } catch (e) {
        console.error("Failed to get pending work count", e);
        return { pendingJobs: 0, retryingSessions: 0 };
    }
}

// --- Predefined Prompts ---
export async function getPredefinedPrompts(profileId: string = 'default'): Promise<PredefinedPrompt[]> {
    return new Promise((resolve, reject) => {
        if (process.env.MOCK_API === 'true' && process.env.HYBRID_MOCK !== 'true') {
             return resolve(MOCK_PREDEFINED_PROMPTS.filter(p => p.profileId === profileId));
        }
        promptClient.listPredefinedPrompts({}, (err, res) => {
             if (err) return reject(err);
             resolve(res.prompts.filter(p => p.profileId === profileId));
        });
    });
}

export async function savePredefinedPrompts(prompts: PredefinedPrompt[]): Promise<void> {
    const profileId = prompts.length > 0 ? prompts[0].profileId || 'default' : 'default';
    
    // Delete existing?
    // Backend API `CreateManyPredefinedPrompts` appends.
    // Original logic: DELETE all for profile, then INSERT.
    // My Proto API: List, Get, Create, Update, Delete. No "ReplaceAll".
    // I should probably implement "ReplaceAll" logic in backend or client.
    // Client side: Delete all for profile (fetch then delete), then create many.
    // This is race-condition prone.
    // Or I can add a `ReplacePredefinedPrompts` RPC.
    // For now, I'll fetch and delete then create.
    
    if (process.env.MOCK_API === 'true') return;

    try {
        const existing = await getPredefinedPrompts(profileId);
        // Delete all
        await Promise.all(existing.map(p => new Promise<void>((resolve, reject) => {
            promptClient.deletePredefinedPrompt({ id: p.id }, (err) => err ? reject(err) : resolve());
        })));
        
        // Create new
        if (prompts.length > 0) {
            await new Promise<void>((resolve, reject) => {
                 const reqPrompts = prompts.map(p => ({
                     ...p,
                     profileId
                 }));
                 promptClient.createManyPredefinedPrompts({ prompts: reqPrompts }, (err) => err ? reject(err) : resolve());
            });
        }
        revalidatePath('/settings');
    } catch (e) {
        console.error(e);
        throw e;
    }
}

// --- History Prompts ---
export async function getHistoryPrompts(profileId: string = 'default'): Promise<HistoryPrompt[]> {
    // Need settings for limit?
    // Original used db.select from settings.
    // My `GetRecentHistoryPrompts` takes a limit.
    // I should fetch settings first.
    
    try {
        if (process.env.MOCK_API === 'true') return [];

        const settings = await new Promise<Settings>((resolve, reject) => {
            settingsClient.getSettings({ profileId }, (err, res) => err ? reject(err) : resolve(res));
        });
        const limit = settings.historyPromptsCount || 10;
        
        return new Promise((resolve, reject) => {
            promptClient.getRecentHistoryPrompts({ limit }, (err, res) => {
                 if (err) return reject(err);
                 resolve(res.prompts.filter(p => p.profileId === profileId));
            });
        });
    } catch (e) {
        console.error(e);
        return [];
    }
}

export async function saveHistoryPrompt(promptText: string, _profileId: string = 'default'): Promise<void> {
    if (!promptText.trim()) return;
    console.log(`[actions] saveHistoryPrompt profile=${_profileId}`); 
    return new Promise((resolve, reject) => {
        if (process.env.MOCK_API === 'true') return resolve();
        promptClient.saveHistoryPrompt({ prompt: promptText }, (err) => {
            if (err) return reject(err);
            revalidatePath('/');
            resolve();
        });
    });
}

// --- Quick Replies ---
export async function getQuickReplies(profileId: string = 'default'): Promise<PredefinedPrompt[]> {
    return new Promise((resolve, reject) => {
        if (process.env.MOCK_API === 'true') {
             return resolve(MOCK_QUICK_REPLIES.filter(p => p.profileId === profileId));
        }
         promptClient.listQuickReplies({}, (err, res) => {
              if (err) return reject(err);
              resolve(res.prompts.filter(p => p.profileId === profileId));
         });
    });
}

export async function saveQuickReplies(replies: PredefinedPrompt[]): Promise<void> {
    const profileId = replies.length > 0 ? replies[0].profileId || 'default' : 'default';
     if (process.env.MOCK_API === 'true') return;

     try {
        const existing = await getQuickReplies(profileId);
        
        await Promise.all(existing.map(p => new Promise<void>((resolve, reject) => {
            promptClient.deleteQuickReply({ id: p.id }, (err) => err ? reject(err) : resolve());
        })));
        
        if (replies.length > 0) {
            await new Promise<void>((resolve, reject) => {
                  const reqPrompts = replies.map(p => ({ ...p, profileId }));
                  promptClient.createManyQuickReplies({ prompts: reqPrompts }, (err) => err ? reject(err) : resolve());
            });
        }
        revalidatePath('/settings');
    } catch (e) {
        console.error(e);
        throw e;
    }
}

// --- Global Prompt ---
export async function getGlobalPrompt(_profileId: string = 'default'): Promise<string> {
    console.log(`[actions] getGlobalPrompt profile=${_profileId}`);
    return new Promise((resolve) => {
        if (process.env.MOCK_API === 'true') return resolve("");
        promptClient.getGlobalPrompt({}, (err, res) => {
            if (err) return resolve(""); // Handle error as empty?
            resolve(res.prompt);
        });
    });
}

export async function saveGlobalPrompt(prompt: string, _profileId: string = 'default'): Promise<void> {
    console.log(`[actions] saveGlobalPrompt profile=${_profileId}`);
    return new Promise((resolve, reject) => {
        if (process.env.MOCK_API === 'true') return resolve();
         promptClient.saveGlobalPrompt({ prompt }, (err) => {
             if (err) return reject(err);
             revalidatePath('/settings');
             resolve();
         });
    });
}

// --- Repo Prompt ---
export async function getRepoPrompt(repo: string, profileId: string = 'default'): Promise<string> {
    return new Promise((resolve) => {
        if (process.env.MOCK_API === 'true') return resolve("");
        promptClient.getRepoPrompt({ repo }, (err, res) => {
             if (err) return resolve("");
             if (res.profileId !== profileId && res.profileId !== 'default' && res.profileId !== '') return resolve(""); // strict profile check?
             resolve(res.prompt);
        });
    });
}

export async function saveRepoPrompt(repo: string, prompt: string, _profileId: string = 'default'): Promise<void> {
    console.log(`[actions] saveRepoPrompt profile=${_profileId}`);
    return new Promise((resolve, reject) => {
        if (process.env.MOCK_API === 'true') return resolve();
        promptClient.saveRepoPrompt({ repo, prompt }, (err) => {
            if (err) return reject(err);
            revalidatePath('/settings');
            resolve();
        });
    });
}

// --- Settings ---
export async function getSettings(profileId: string = 'default'): Promise<Settings | undefined> {
     return new Promise((resolve, reject) => {
         if (process.env.MOCK_API === 'true' && process.env.HYBRID_MOCK !== 'true') {
             return resolve(MOCK_SETTINGS);
         }
         settingsClient.getSettings({ profileId }, (err, res) => {
             if (err) return reject(err);
             resolve(res);
         });
     });
}
