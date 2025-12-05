
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
export async function getSettings(profileId?: string): Promise<Settings> {
  let query = db.select().from(settings).limit(1);
  if (profileId) {
      // @ts-ignore
      query = query.where(eq(settings.profileId, profileId));
  }
  const existingSettings = await query;

  if (existingSettings.length > 0) {
    return existingSettings[0];
  }

  // Create default settings if not found
  // If profileId is provided, create for that profile.
  // But usually settings are created when profile is created.
  // We can return a default object or try to create.

  if (profileId) {
      // Try to create only if we are sure it's valid
      const defaultSettings = await db.insert(settings).values({
        profileId,
        idlePollInterval: 120,
        activePollInterval: 30,
        sessionCacheInProgressInterval: 60,
        sessionCacheCompletedNoPrInterval: 1800,
        sessionCachePendingApprovalInterval: 300,
        sessionCacheMaxAgeDays: 3,
      }).returning();
      return defaultSettings[0];
  }

  // Fallback for no profile (should check existing logic)
  // This path might be deprecated if we enforce profileId
  const defaultSettings = await db.insert(settings).values({
    id: 1, // Singleton ID if no profile
    idlePollInterval: 120,
    activePollInterval: 30,
    sessionCacheInProgressInterval: 60,
    sessionCacheCompletedNoPrInterval: 1800,
    sessionCachePendingApprovalInterval: 300,
    sessionCacheMaxAgeDays: 3,
  }).onConflictDoNothing().returning(); // In case ID 1 exists but query failed earlier?

  if (defaultSettings.length > 0) return defaultSettings[0];

  // If conflict happened and we returned nothing, fetch again
  return (await db.select().from(settings).limit(1))[0];
}

/**
 * Saves or updates a session in the local database.
 */
export async function upsertSession(session: Session, profileId?: string) {
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
    // Only set profileId if provided. If not provided, we preserve existing or set to default if new?
    // DB schema has nullable profileId, or default?
    // If we update, we should probably keep existing profileId unless explicitly changing it.
    // If it's a new insert, we need profileId.
  };

  // Check if session exists to preserve profileId if not provided
  const existing = await db.select().from(sessions).where(eq(sessions.id, session.id)).get();
  let finalProfileId = profileId;

  if (existing) {
      if (!finalProfileId) {
          finalProfileId = existing.profileId || undefined;
      }
  }

  // Combine data
  const finalData = {
      ...sessionData,
      profileId: finalProfileId
  };

  await db.insert(sessions)
    .values(finalData)
    .onConflictDoUpdate({
      target: sessions.id,
      set: finalData,
    });
}

/**
 * Retrieves all sessions from the local database, sorted by creation time descending.
 */
export async function getCachedSessions(profileId?: string): Promise<Session[]> {
  let query = db.select().from(sessions).orderBy(sql`${sessions.createTime} DESC`);

  if (profileId) {
      // @ts-ignore
      query = query.where(eq(sessions.profileId, profileId));
  }

  const cachedSessions = await query;

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
    if (output.pullRequest?.status === 'MERGED') {
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
export async function syncStaleSessions(apiKey: string, profileId?: string) {
  const settings = await getSettings(profileId);
  // Get cached sessions for this profile
  const cachedSessions = await getCachedSessions(profileId);
  // Convert back to DB type to access lastUpdated if needed, but getCachedSessions returns Session type
  // Session type doesn't have lastUpdated (it's in DB schema but mapped out?)
  // Wait, getCachedSessions mapping:
  /*
  return cachedSessions.map(s => ({
    ...s,
    ...
  } as Session));
  */
  // The DB record has lastUpdated. But the return type Session (from lib/types) might not?
  // Let's check lib/types.ts
  // Session type in types.ts does NOT have lastUpdated.

  // So I should query DB directly here instead of using getCachedSessions which might strip fields.

  let query = db.select().from(sessions);
  if (profileId) {
      // @ts-ignore
      query = query.where(eq(sessions.profileId, profileId));
  }
  const dbSessions = await query;

  const now = Date.now();

  const sessionsToUpdate: string[] = [];

  for (const session of dbSessions) {
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
        // @ts-ignore - session is CachedSession which has outputs, isPrMerged expects Session
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
  const BATCH_SIZE = 5;
  for (let i = 0; i < sessionsToUpdate.length; i += BATCH_SIZE) {
    const batch = sessionsToUpdate.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (id) => {
        const updatedSession = await fetchSessionFromApi(id, apiKey);
        if (updatedSession) {
            // Preserve profileId during update
            await upsertSession(updatedSession, profileId);
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
        // We don't have profileId here easily.
        // upsertSession will preserve existing profileId if we don't pass it.
        await upsertSession(updatedSession);
    }
    return updatedSession;
}
