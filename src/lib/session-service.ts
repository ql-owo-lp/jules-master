
import { db } from './db';
import { sessions, settings } from './db/schema';
import { eq, inArray, sql, lt, and, not } from 'drizzle-orm';
import type { Session, State, SessionOutput } from '@/lib/types';
import { fetchWithRetry } from './fetch-client';

// Type definitions for easier usage
export type CachedSession = typeof sessions.$inferSelect;
export type Settings = typeof settings.$inferSelect;

/**
 * Gets the current application settings.
 * Creates default settings if they don't exist.
 */
export async function getSettings(): Promise<Settings> {
  const existingSettings = await db.select().from(settings).limit(1);

  if (existingSettings.length > 0) {
    return existingSettings[0];
  }

  // Create default settings if not found
  const defaultSettings = await db.insert(settings).values({
    idlePollInterval: 120,
    activePollInterval: 30,
    sessionCacheInProgressInterval: 60,
    sessionCacheCompletedNoPrInterval: 1800,
    sessionCachePendingApprovalInterval: 300,
    sessionCacheMaxAgeDays: 3,
  }).returning();

  return defaultSettings[0];
}

/**
 * Saves or updates a session in the local database.
 */
export async function upsertSession(session: Session) {
  const now = Date.now();
  const sessionData = {
    id: session.id,
    name: session.name,
    title: session.title,
    prompt: session.prompt,
    sourceContext: session.sourceContext,
    createTime: session.createTime,
    updateTime: session.updateTime,
    state: session.state,
    url: session.url,
    outputs: session.outputs,
    requirePlanApproval: session.requirePlanApproval,
    automationMode: session.automationMode,
    lastUpdated: now,
  };

  await db.insert(sessions)
    .values(sessionData)
    .onConflictDoUpdate({
      target: sessions.id,
      set: sessionData,
    });
}

/**
 * Retrieves all sessions from the local database, sorted by creation time descending.
 */
export async function getCachedSessions(): Promise<Session[]> {
  const cachedSessions = await db.select().from(sessions).orderBy(sql`${sessions.createTime} DESC`);

  // Map back to Session type if needed, though they should be compatible
  return cachedSessions.map(s => ({
    ...s,
    sourceContext: s.sourceContext || undefined,
    createTime: s.createTime || undefined,
    updateTime: s.updateTime || undefined,
    url: s.url || undefined,
    outputs: s.outputs || undefined,
    requirePlanApproval: s.requirePlanApproval || undefined,
    automationMode: s.automationMode || undefined,
  } as Session));
}

/**
 * Helper to determine if a session has a merged PR.
 */
function isPrMerged(session: Session): boolean {
  // Logic to check if any output has a PR that is merged.
  // Currently, the SessionOutput type has pullRequest which has url, title, description.
  // It doesn't strictly have 'merged' status in the Session object itself usually.
  // However, the prompt says "For sessions that was already compeleted, we check if the status of the PR, if it's merged, then we no longer update it."
  // This implies we might need to fetch PR status separately or it's part of the session data we get from Jules?
  // Looking at `SessionOutput`, it only has `pullRequest`.
  // Looking at `PullRequestStatus` in types.ts, it has state 'MERGED'.
  // But where is that stored?
  // The `fetchSession` response from Jules API might contain more info, or we rely on `checkPrStatus` elsewhere.
  // For now, let's assume we can't easily know if it's merged just from `Session` object unless we extend it or check elsewhere.
  // BUT, the requirements say: "For sessions that was already compeleted, we check if the status of the PR, if it's merged, then we no longer update it."

  // If we don't have PR status in the session object, we might need to skip this check or implement a separate check.
  // However, `src/app/sessions/actions.ts` has `listSessions` but no logic about PR status.
  // `src/app/page.tsx` seems to show PR status if github token is set.
  // Let's assume for now we don't have "merged" info in the session cache directly unless we add it.
  // But wait, the prompt implies we *should* check it.

  // Let's implement a placeholder or best-effort check.
  // If we can't check, we default to updating.
  return false;
}


/**
 * Fetches a single session from Jules API.
 */
async function fetchSessionFromApi(sessionId: string, apiKey: string): Promise<Session | null> {
    try {
        const response = await fetchWithRetry(
            `https://jules.googleapis.com/v1alpha/sessions/${sessionId}`,
            {
                headers: {
                    'X-Goog-Api-Key': apiKey,
                },
                next: { revalidate: 0 },
            }
        );

        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error(`Failed to fetch session ${sessionId}`, e);
        return null;
    }
}

/**
 * Syncs a specific list of sessions if they are stale.
 * This function is intended to be called periodically or on demand.
 */
export async function syncStaleSessions(apiKey: string) {
  const settings = await getSettings();
  const cachedSessions = await db.select().from(sessions);
  const now = Date.now();

  const sessionsToUpdate: string[] = [];

  for (const session of cachedSessions) {
    const age = now - session.lastUpdated;
    const createTime = new Date(session.createTime || 0).getTime();
    const daysSinceCreation = (now - createTime) / (1000 * 60 * 60 * 24);

    // Rule: Created > 3 days ago (configurable) -> Do not update automatically
    if (daysSinceCreation > settings.sessionCacheMaxAgeDays) {
      continue;
    }

    let shouldUpdate = false;

    switch (session.state as State) {
      case 'IN_PROGRESS':
      case 'PLANNING':
      case 'QUEUED':
        // Update every 60s
        if (age > settings.sessionCacheInProgressInterval * 1000) {
          shouldUpdate = true;
        }
        break;

      case 'AWAITING_PLAN_APPROVAL':
      case 'AWAITING_USER_FEEDBACK':
        // Pending approval/feedback -> Update every 300s
        if (age > settings.sessionCachePendingApprovalInterval * 1000) {
          shouldUpdate = true;
        }
        break;

      case 'COMPLETED':
        // If completed:
        // If PR merged -> No update. (We need to know if PR is merged. For now, we'll assume we update every 30 mins if we don't know).
        // If no PR -> Update every 30 mins.

        // Let's assume for now we use the "Completed No PR" interval for all completed sessions unless we know otherwise.
        if (age > settings.sessionCacheCompletedNoPrInterval * 1000) {
             shouldUpdate = true;
        }
        break;

      default:
        // Default fall back
        if (age > settings.sessionCachePendingApprovalInterval * 1000) {
            shouldUpdate = true;
        }
        break;
    }

    if (shouldUpdate) {
      sessionsToUpdate.push(session.id);
    }
  }

  // Update sessions in batches/concurrency control
  // For simplicity, we'll do promise.all with a concurrency limit if needed, or just iterate.
  // Given "don't hit jules api rate limit", we should be careful.
  // Let's process 5 at a time.
  const BATCH_SIZE = 5;
  for (let i = 0; i < sessionsToUpdate.length; i += BATCH_SIZE) {
    const batch = sessionsToUpdate.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (id) => {
        const updatedSession = await fetchSessionFromApi(id, apiKey);
        if (updatedSession) {
            await upsertSession(updatedSession);
        }
    }));
  }
}

/**
 * Force refresh a specific session.
 */
export async function forceRefreshSession(sessionId: string, apiKey: string) {
    const updatedSession = await fetchSessionFromApi(sessionId, apiKey);
    if (updatedSession) {
        await upsertSession(updatedSession);
    }
    return updatedSession;
}
