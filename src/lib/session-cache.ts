
import { db } from './db';
import { sessionCache, settings } from './db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { Session, State } from './types';
import { fetchWithRetry } from './fetch-client';

type ListSessionsResponse = {
  sessions: Session[];
  nextPageToken?: string;
};

// Default settings if not found in DB
const DEFAULT_SETTINGS = {
  sessionCacheDays: 3,
  sessionInProgressInterval: 60,
  sessionCompletedInterval: 1800, // 30 minutes
  sessionPendingInterval: 300,
};

async function getSettings() {
  const result = await db.select().from(settings).limit(1);
  if (result.length > 0) {
    return result[0];
  }
  return DEFAULT_SETTINGS;
}

function shouldUpdateSession(
  cachedSession: typeof sessionCache.$inferSelect,
  currentSettings: typeof DEFAULT_SETTINGS,
  forceRefresh: boolean
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const lastUpdated = cachedSession.lastUpdated;
  const timeSinceLastUpdate = now - lastUpdated;
  const createdTime = cachedSession.createdAt;
  const ageInDays = (now - createdTime) / (24 * 60 * 60);

  // Rule: Session > 3 days old, do not update (unless manual refresh, which is handled separately)
  if (ageInDays > currentSettings.sessionCacheDays && !forceRefresh) {
    return false;
  }

  // If forced refresh, we update regardless of interval
  if (forceRefresh) {
      return true;
  }

  // Rule: Completed + Merged PR -> No update
  if (cachedSession.state === 'COMPLETED' && cachedSession.prMerged) {
    return false;
  }

  // Rule: Completed + No PR (or not merged) -> Update every 30 mins
  if (cachedSession.state === 'COMPLETED') {
    return timeSinceLastUpdate > currentSettings.sessionCompletedInterval;
  }

  // Rule: In Progress -> Update every 60s
  if (cachedSession.state === 'IN_PROGRESS' || cachedSession.state === 'RUNNING' || cachedSession.state === 'PLANNING' || cachedSession.state === 'QUEUED') {
    return timeSinceLastUpdate > currentSettings.sessionInProgressInterval;
  }

  // Rule: Pending Approval -> Update every 300s
  if (cachedSession.state === 'AWAITING_PLAN_APPROVAL' || cachedSession.state === 'AWAITING_USER_FEEDBACK') {
    return timeSinceLastUpdate > currentSettings.sessionPendingInterval;
  }

  // Default fallback (e.g. FAILED, PAUSED) - treat as completed or pending?
  // Let's treat them as completed for now to avoid spamming
  return timeSinceLastUpdate > currentSettings.sessionCompletedInterval;
}

// Check if PR is merged based on session output
// Note: The session object from Jules API might not have direct "merged" status for PR.
// It usually has a link. We might need to fetch PR status separately if we want to be 100% sure.
// However, the prompt says "For sessions that was already compeleted, we check if the status of the PR, if it's merged, then we no longer update it."
// This implies we have that info. If it's not in the Session object, we might need to fetch it.
// Looking at `src/lib/types.ts`, `SessionOutput` has `pullRequest`.
// But `PullRequest` type only has `url`, `title`, `description`. It doesn't have status.
// `GitHubPullRequest` has `merged` boolean.
// We might need to rely on the client or another process to update the PR status in the cache if it's not in the session object.
// OR, we assume the `Session` object gets updated when PR is merged.
// For now, I will stick to what's available in the Session object.
// If the session state is COMPLETED, and we don't have PR info, we might not be able to know if it's merged.
// **CRITICAL**: The prompt says "check if the status of the PR, if it's merged".
// This implies I might need to check GitHub API if the session has a PR.
// But calling GitHub API for every session is also expensive.
// Maybe I should only check GitHub API if it's not marked as merged yet.
// AND if I have a GitHub token.

async function checkPrStatus(session: Session, githubToken?: string): Promise<boolean> {
  if (!session.outputs) return false;

  const prOutput = session.outputs.find(o => o.pullRequest);
  if (!prOutput || !prOutput.pullRequest) return false;

  const prUrl = prOutput.pullRequest.url;
  // Parse owner, repo, pull_number from URL
  // https://github.com/owner/repo/pull/123
  const match = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
  if (!match) return false;

  const [, owner, repo, pullNumber] = match;

  if (!githubToken) return false;

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`, {
        headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });
    if (response.ok) {
        const data = await response.json();
        return data.merged === true;
    }
  } catch (e) {
      console.error("Failed to check PR status", e);
  }
  return false;
}

export async function getCachedSessions(apiKey: string, githubToken?: string, requestId?: string, forceRefresh: boolean = false): Promise<Session[]> {
    const currentSettings = await getSettings();
    const now = Math.floor(Date.now() / 1000);

    // 1. Fetch all cached sessions
    const cachedSessions = await db.select().from(sessionCache);
    const cachedSessionMap = new Map(cachedSessions.map(s => [s.sessionId, s]));

    // 2. Determine which sessions need update
    // We also need to know about *new* sessions that are not in cache.
    // But we can't know about them unless we fetch from API.
    // Strategy:
    // Always fetch the first page of sessions from API to get new ones?
    // Or, if we have cached sessions, we only update those that are expired?
    // The prompt says "Update the way how we fetch session status... when we have a lot of session status to be updated, we don't hit jules api rate limit."
    // This implies we want to avoid listing *all* sessions every time if possible.
    // But `listSessions` (API) returns a list.
    // If we call `listSessions` (API) we get everything (paginated).
    // If we want to update specific sessions, we need `getSession` (API).

    // If the user expects to see *new* sessions, we MUST call `listSessions` (API) at least for the first page?
    // Or we can rely on the cache and background updates?
    // But how do we populate the cache initially?
    // Let's assume we fetch the list from API, but we might do it less frequently or intelligently?
    // Wait, the prompt says "The key is... We build cache for session status... We update session status following an interval...".
    // This sounds like we are shifting from "Fetch List" to "Read Cache + Update Individual items".

    // BUT, if I create a new session, I want to see it immediately.
    // If I just read from cache, I won't see it.

    // Maybe the flow is:
    // 1. Fetch list of sessions from API (lightweight if possible? Jules API `listSessions` returns full objects).
    // If we call `listSessions` API every time, we hit rate limits if we have many users or frequent polls.
    // BUT `listSessions` API itself might be rate limited.

    // If I look at the prompt again: "For session who was created more than 3 days ago... we no longer update the cache or pull status from jules API".
    // This implies we iterate over known sessions and update them.

    // So:
    // 1. Return what's in the cache immediately?
    // 2. In the background (or same request but async?), iterate over cached sessions.
    // 3. Filter those that need update.
    // 4. Fetch updates for those specific sessions (using `getSession` API?).
    // 5. Update cache.

    // BUT, what about *new* sessions?
    // If we don't call `listSessions` API, we miss new sessions created by other means (e.g. CLI).
    // If we only use this UI to create sessions, we can add them to cache on creation.
    // But if we want to sync, we probably need to fetch the list occasionally.

    // Maybe we still call `listSessions` API, but we rely on `updateTime`?
    // Jules API `listSessions` doesn't seem to support filtering by "updated since".

    // Let's assume `listSessions` (the function I'm modifying) is called frequently by the client polling.
    // We want to serve this from cache.
    // And then trigger a background update process?

    // Implementation Plan:
    // 1. Fetch all from DB.
    // 2. Identify sessions to update (based on rules).
    // 3. If there are sessions to update, fetch them.
    //    - If there are MANY, we need to batch or limit?
    //    - We should prioritize.
    // 4. ALSO, we need to discover new sessions.
    //    - We can fetch the *first page* of `listSessions` from API to get the latest ones.
    //    - Merging strategy:
    //      - Latest sessions from API (page 1) -> Update Cache.
    //      - Older sessions -> Check if they need update based on cache rules -> `getSession`.

    // Let's try to combine:
    // 1. Fetch cached sessions.
    // 2. Fetch Page 1 from API (contains most recent sessions).
    // 3. Update cache with Page 1 data.
    // 4. For sessions *not* in Page 1 but in Cache (older sessions), check if they need update.
    // 5. Fetch updates for those specific sessions.
    // 6. Return all sessions (sorted).

    // NOTE: Fetching individual sessions (`getSession`) for 50 outdated sessions will hit rate limits faster than 1 `listSessions`.
    // So we should be careful.
    // If we have 100 in-progress sessions, we don't want to fire 100 requests every 60s if the rate limit is tight.
    // But the prompt says "we don't hit jules api rate limit" by using intervals.
    // The intervals (60s, 30m, 300s) are meant to reduce frequency.

    const sessionsToUpdate: string[] = [];
    const sessionsToCheckPr: Session[] = [];

    // Check existing cache items
    for (const session of cachedSessions) {
        if (shouldUpdateSession(session, currentSettings, forceRefresh)) {
            sessionsToUpdate.push(session.sessionId);
        } else if (session.state === 'COMPLETED' && !session.prMerged && session.data.outputs?.some((o:any) => o.pullRequest)) {
             // Even if we don't update the whole session, we might want to check PR status?
             // The rule says "For sessions that was already compeleted, we check if the status of the PR, if it's merged, then we no longer update it."
             // This implies checking PR status is part of the update.
             // If we decided NOT to update based on interval (30 min), we skip.
             // If we DO update (every 30 mins), we check PR.
        }
    }

    // However, we also need to find NEW sessions.
    // Let's fetch the first page from API (size 50?). This ensures we see new stuff.
    // We can assume that anything older than Page 1 is already in cache (or we missed it, but eventually we might catch up if we paginate deeper, but for now let's stick to Page 1 for "discovery").

    let apiSessions: Session[] = [];
    try {
        const url = new URL('https://jules.googleapis.com/v1alpha/sessions');
        url.searchParams.set('pageSize', '50'); // Fetch 50 latest

        const response = await fetchWithRetry(url.toString(), {
            headers: { 'X-Goog-Api-Key': apiKey },
            next: { revalidate: 0 }, // No Next.js cache, we want fresh list
            requestId
        });

        if (response.ok) {
            const data: ListSessionsResponse = await response.json();
            apiSessions = (data.sessions || []).map(s => ({...s, createTime: s.createTime || ''}));
        }
    } catch (e) {
        console.error("Failed to fetch fresh sessions list", e);
    }

    // Process API sessions: Update Cache
    const processedSessionIds = new Set<string>();

    for (const session of apiSessions) {
        processedSessionIds.add(session.id);

        // Check PR status if completed
        let isMerged = false;
        if (session.state === 'COMPLETED') {
             // Check cache first to see if we already know it's merged
             const cached = cachedSessionMap.get(session.id);
             if (cached?.prMerged) {
                 isMerged = true;
             } else {
                 // If not known merged, and we have GitHub token, we might want to check.
                 // But we can't do this for every session in the list synchronously.
                 // We will do it if it's "time to update" or if it's a new completion.
                 // For simplicity, let's defer PR check to the "individual update" phase or specific check.
                 // OR, we assume we don't know yet.
             }
        }

        await updateCache(session, isMerged);

        // Remove from sessionsToUpdate if we just fetched it
        const index = sessionsToUpdate.indexOf(session.id);
        if (index > -1) {
            sessionsToUpdate.splice(index, 1);
        }
    }

    // Now handle the "Old but needs update" sessions
    // These are sessions that were NOT in the top 50, but are in our cache and marked as needing update.
    // We fetch them individually.
    // Limit concurrency?

    // Limit to updating max 10 old sessions per request to avoid blocking?
    const batchToUpdate = sessionsToUpdate.slice(0, 10);

    await Promise.all(batchToUpdate.map(async (sessionId) => {
        try {
            const response = await fetchWithRetry(
                `https://jules.googleapis.com/v1alpha/sessions/${sessionId}`,
                {
                    headers: { "X-Goog-Api-Key": apiKey },
                    cache: "no-store",
                }
            );
            if (response.ok) {
                const session: Session = await response.json();
                let isMerged = false;

                if (session.state === 'COMPLETED') {
                    // Here we can check PR status since we are updating this specific session
                    const cached = cachedSessionMap.get(sessionId);
                    if (cached?.prMerged) {
                        isMerged = true;
                    } else if (githubToken) {
                         isMerged = await checkPrStatus(session, githubToken);
                    }
                }

                await updateCache(session, isMerged);
            }
        } catch (e) {
            console.error(`Failed to update session ${sessionId}`, e);
        }
    }));

    // Finally, return all cached sessions, sorted by createTime desc
    const finalCached = await db.select().from(sessionCache);
    const result = finalCached.map(r => r.data as Session);

    return result.sort((a, b) => {
        const tA = new Date(a.createTime || 0).getTime();
        const tB = new Date(b.createTime || 0).getTime();
        return tB - tA;
    });
}

export async function updateSessionInCache(session: Session, githubToken?: string) {
     let isMerged = false;
     if (session.state === 'COMPLETED' && githubToken) {
         isMerged = await checkPrStatus(session, githubToken);
     }
     await updateCache(session, isMerged);
}

async function updateCache(session: Session, prMerged: boolean) {
    const now = Math.floor(Date.now() / 1000);
    const createTime = session.createTime ? Math.floor(new Date(session.createTime).getTime() / 1000) : now;

    await db.insert(sessionCache).values({
        sessionId: session.id,
        data: session,
        lastUpdated: now,
        state: session.state,
        prMerged: prMerged,
        createdAt: createTime
    }).onConflictDoUpdate({
        target: sessionCache.sessionId,
        set: {
            data: session,
            lastUpdated: now,
            state: session.state,
            // If prMerged is true, set it. If false, keep existing (once merged, always merged)
            prMerged: prMerged ? true : sql`session_cache.pr_merged`,
        }
    });
}
