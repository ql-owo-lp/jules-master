
import { db } from './db';
import { sessions, settings } from './db/schema';
import { eq, inArray, sql, lt, and, not, gt } from 'drizzle-orm';
import type { Session, State, SessionOutput } from '@/lib/types';
import { fetchWithRetry } from './fetch-client';

// Type definitions for easier usage
export type CachedSession = typeof sessions.$inferSelect;
export type Settings = typeof settings.$inferSelect;

/**
 * Gets the current application settings.
 * Creates default settings if they don't exist.
 */
export async function getSettings(profileId: string = 'default'): Promise<Settings> {
  const existingSettings = await db.select().from(settings).where(eq(settings.profileId, profileId)).limit(1);

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
    profileId: profileId
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
    state: session.state || 'STATE_UNSPECIFIED',
    url: session.url,
    outputs: session.outputs,
    requirePlanApproval: session.requirePlanApproval,
    automationMode: session.automationMode,
    lastUpdated: now,
    // Only include profileId if provided, otherwise let database default handle insert,
    // and rely on partial update logic (see below) to not overwrite existing profileId
    ...(session.profileId ? { profileId: session.profileId } : {})
  };

  // If we have a profileId in the object (or merged from arg), we perform full upsert including it.
  // If not, we perform upsert but exclude profileId from SET clause to preserve existing association.

  const safeSessionData = { ...sessionData };
  // Drizzle needs explicit handling.
  // If we are inserting and profileId is missing, it uses default.
  // If updating and profileId is missing in `values` object, Drizzle doesn't touch it?
  // We passed it to `values`.
  
  // Actually, we can just filter the object for the SET clause.
  const setPayload = { ...sessionData };
  if (!sessionData.profileId) {
      delete (setPayload as any).profileId;
  }

  await db.insert(sessions)
    .values(sessionData as any) // Type assertion might be needed if dynamic keys
    .onConflictDoUpdate({
      target: sessions.id,
      set: setPayload,
    });
}

/**
 * Updates the last interaction timestamp for a session.
 */
export async function updateSessionInteraction(sessionId: string) {
    const now = Date.now();
    await db.update(sessions)
        .set({ lastInteractionAt: now })
        .where(eq(sessions.id, sessionId));
}

/**
 * Retrieves all sessions from the local database, sorted by creation time descending.
 */
export async function getCachedSessions(profileId: string = 'default'): Promise<Session[]> {
  const cachedSessions = await db.select().from(sessions)
    .where(eq(sessions.profileId, profileId))
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
    profileId: s.profileId,
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
        const session = await response.json();

        // Ensure ID is populated from name if missing
        if (!session.id && session.name) {
            const parts = session.name.split('/');
            if (parts.length > 1) {
                session.id = parts[parts.length - 1];
            }
        }

        return session;
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
    // We strictly should sync based on per-profile settings, but iterating all sessions in DB
    // allows a background worker to keep everything fresh regardless of active profile.
    // However, we need settings (thresholds).
    // Let's iterate all profiles? Or just use 'default' settings as a baseline?
    // Or fetch settings for the session's profile?
    
    // For MVP efficiency, we'll fetch 'default' settings and apply to all sessions, 
    // OR we iterate sessions and lazily fetch their profile settings if needed.
    // Since we don't have many profiles, maybe we just loop through all settings?
    
    // Simplification: Use default settings for thresholds.
    const settings = await getSettings('default');

    // Optimization: Select only necessary columns and filter by time in SQL
    // to reduce memory usage and DB load.
    const now = Date.now();
    const cutoff = now - settings.sessionCacheInProgressInterval * 1000;

    // We also don't need to check sessions older than max age (approx)
    const maxAgeCutoff = now - settings.sessionCacheMaxAgeDays * 24 * 60 * 60 * 1000;
    // createTime is string ISO. Comparison works if format is standard.
    const maxAgeIso = new Date(maxAgeCutoff).toISOString();

    const cachedSessions = await db.select({
      id: sessions.id,
      state: sessions.state,
      lastUpdated: sessions.lastUpdated,
      createTime: sessions.createTime,
      outputs: sessions.outputs,
    })
    .from(sessions)
    .where(and(
      lt(sessions.lastUpdated, cutoff),
      gt(sessions.createTime, maxAgeIso)
    ));

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
        if (isPrMerged(session as any)) {
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
            // Ensure no nulls in sourceContext - fetchSessionFromApi does not sanitize?
            // I updated src/app/sessions/actions.ts "fetchSessionsPage" logic in the previous step,
            // but the error was in "fetchSessionFromApi" in src/lib/session-service.ts ?? 
            // src/lib/session-service.ts defines fetchSessionFromApi locally!
            // I need to update THAT one.
             const sanitizedSession = {
                ...updatedSession,
                sourceContext: updatedSession.sourceContext || undefined,
                url: updatedSession.url || undefined,
                outputs: updatedSession.outputs || undefined,
                requirePlanApproval: updatedSession.requirePlanApproval ?? undefined,
                automationMode: updatedSession.automationMode || undefined,
             } as Session; // Force cast to avoid null vs undefined issues if runtime object has nulls
            await upsertSession(sanitizedSession);
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
