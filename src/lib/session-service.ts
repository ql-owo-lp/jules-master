
import { db } from './db';
import { sessions, settings, profiles } from './db/schema';
import { eq, inArray, sql, lt, and, not } from 'drizzle-orm';
import type { Session, State, SessionOutput } from '@/lib/types';
import { fetchWithRetry } from './fetch-client';
import { appDatabase } from './db';

// Type definitions for easier usage
export type CachedSession = typeof sessions.$inferSelect;
export type Settings = typeof settings.$inferSelect;

/**
 * Gets the current application settings.
 * Creates default settings if they don't exist.
 */
export async function getSettings(): Promise<Settings> {
  // Use active profile
  const activeProfile = await appDatabase.profiles.getActive();
  const existingSettings = await db.select().from(settings).where(eq(settings.profileId, activeProfile.id)).limit(1);

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
    profileId: activeProfile.id
  }).returning();

  return defaultSettings[0];
}

/**
 * Saves or updates a session in the local database.
 */
export async function upsertSession(session: Session) {
  const now = Date.now();
  const activeProfile = await appDatabase.profiles.getActive();

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
    profileId: activeProfile.id // Associate with active profile
  };

  // Check if session exists to preserve profileId if it was created under a different profile?
  // Or do we always overwrite with active?
  // Requirement: "convert the settings / jobs/ everything to be aware of user / profile".
  // Sessions are fetched from API. If a session belongs to User A's API key, it should probably be associated with User A's profile.
  // But here we rely on active profile context.
  // Ideally, we should check if session exists and keep its profileId unless we are explicitly importing it?
  // But `upsertSession` is called during sync. If I switch profile and sync, do I see other profile's sessions?
  // Sessions in API are bound to the API Key (Jules/Google Cloud Project).
  // If Profile A and Profile B use same API Key, they see same sessions.
  // If they use different API keys, they see different sessions.
  // The DB cache should probably reflect that.
  // If `upsertSession` is called, it means we fetched it using the CURRENT API key (associated with current profile).
  // So it's safe to assign current profile ID.

  // However, if we switch profiles, `getActive` returns new profile.
  // If we fetched the session using Profile A's key, we shouldn't overwrite it with Profile B's ID if we happen to run this function while Profile B is active but we are processing Profile A's stuff?
  // `runBackgroundJobCheck` runs globally?
  // `runBackgroundJobCheck` reads `JULES_API_KEY` from env or settings?
  // In `src/lib/background-job-worker.ts`, it reads `process.env.JULES_API_KEY`.
  // Wait, the worker reads from ENV. If we support multiple profiles with different keys, the worker needs to iterate profiles or use the active one's key?
  // The requirement says: "including different github api / jules api... We can also extend this to a multi-user settings".
  // Currently the app uses `process.env` or local storage for keys.
  // The settings page saves keys to local storage. The backend might not have access to local storage keys unless passed.
  // `actions.ts` uses `process.env` mostly, or expects the client to pass it?
  // Actually `useEnv` hook provides context.
  // But `background-job-worker` runs in background (on server?).
  // If it runs on server, it can only see ENV vars or DB.
  // We need to store API keys in DB `settings` table if we want the background worker to use them per profile.
  // But `settings` table currently doesn't have api keys.
  // The prompt says "different github api / jules api".
  // I should probably add api keys to `settings` or `profiles` table.
  // But for security, maybe storing in DB is risky? But `local-storage` is client side only.
  // The `BackgroundJobWorker` currently relies on `process.env.JULES_API_KEY`.
  // If I want to support multiple profiles, I should probably allow storing keys in DB (maybe encrypted, but let's keep it simple for now or assume ENV is for default profile).

  // For now, I will stick to assigning `activeProfile.id` here.

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
  const activeProfile = await appDatabase.profiles.getActive();
  const cachedSessions = await db.select().from(sessions)
    .where(eq(sessions.profileId, activeProfile.id))
    .orderBy(sql`${sessions.createTime} DESC`);

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
export function isPrMerged(session: Session): boolean {
  if (!session.outputs) {
    return false;
  }

  for (const output of session.outputs) {
    if (output.pullRequest?.status?.toUpperCase() === 'MERGED') {
      return true;
    }
  }

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

        if (!response.ok) {
            if (response.status === 404) {
                 console.warn(`Session not found during sync: ${sessionId}`);
            } else {
                 console.warn(`Failed to fetch session ${sessionId}: ${response.status} ${response.statusText}`);
            }
            return null;
        }
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
  const activeProfile = await appDatabase.profiles.getActive();
  const cachedSessions = await db.select().from(sessions).where(eq(sessions.profileId, activeProfile.id));
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
        if (isPrMerged(session)) {
          break;
        }
        // If completed and PR is not merged, update every 30 mins.
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
