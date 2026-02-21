
import { db } from './db';
import { sessions, settings } from './db/schema';
import { eq, sql, lt, and, gt, or, inArray, notInArray } from 'drizzle-orm';
import type { Session, SessionOutput } from '@/lib/types';
import { fetchWithRetry } from './fetch-client';
import { getApiKeys } from './config';

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

  // Extract PR info for optimization columns
  let prUrl: string | null = null;
  let isMerged = false;
  if (session.outputs) {
    for (const output of session.outputs) {
      if (output.pullRequest) {
        if (!prUrl && output.pullRequest.url) {
            prUrl = output.pullRequest.url;
        }
        if (output.pullRequest.status?.toUpperCase() === 'MERGED') {
          isMerged = true;
        }
      }
    }
  }

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
    prUrl: prUrl,
    isPrMerged: isMerged,
    // Only include profileId if provided, otherwise let database default handle insert,
    // and rely on partial update logic (see below) to not overwrite existing profileId
    ...(session.profileId ? { profileId: session.profileId } : {})
  };

  // If we have a profileId in the object (or merged from arg), we perform full upsert including it.
  // If not, we perform upsert but exclude profileId from SET clause to preserve existing association.


  // Drizzle needs explicit handling.
  // If we are inserting and profileId is missing, it uses default.
  // If updating and profileId is missing in `values` object, Drizzle doesn't touch it?
  // We passed it to `values`.
  
  // Actually, we can just filter the object for the SET clause.
  const setPayload = { ...sessionData };
  if (!sessionData.profileId) {
      delete (setPayload as Record<string, unknown>).profileId;
  }

  await db.insert(sessions)
    .values(sessionData)
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
  // Optimization: Select only necessary columns for list view.
  // Exclude heavy fields like lastError, retryCount, lastInteractionAt, lastUpdated.
  // Also avoid fetching the potentially large 'outputs' JSON blob, using 'prUrl' instead.
  const cachedSessions = await db.select({
    id: sessions.id,
    name: sessions.name,
    title: sessions.title,
    prompt: sessions.prompt,
    sourceContext: sessions.sourceContext,
    createTime: sessions.createTime,
    updateTime: sessions.updateTime,
    state: sessions.state,
    url: sessions.url,
    prUrl: sessions.prUrl,
    requirePlanApproval: sessions.requirePlanApproval,
    automationMode: sessions.automationMode,
    profileId: sessions.profileId,
  })
    .from(sessions)
    .where(eq(sessions.profileId, profileId))
    .orderBy(sql`${sessions.createTime} DESC`);

  // Map back to Session type if needed, though they should be compatible
  return cachedSessions.map(s => {
    // Reconstruct a lightweight output object for UI compatibility
    let outputs: SessionOutput[] | undefined = undefined;
    if (s.prUrl) {
      outputs = [{
        pullRequest: {
          url: s.prUrl,
          title: '', // Not needed for list view URL check
          description: '', // Not needed for list view URL check
        }
      }];
    }

    return {
      ...s,
      sourceContext: s.sourceContext || undefined,
      createTime: s.createTime || undefined,
      updateTime: s.updateTime || undefined,
      url: s.url || undefined,
      outputs: outputs,
      requirePlanApproval: s.requirePlanApproval || undefined,
      automationMode: s.automationMode || undefined,
      profileId: s.profileId,
    } as Session;
  });
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
            // We'll return null on 404. 
            // On 403/401, we might want to throw to let caller try next key?
            // But currently caller just logs.
            // Let's return null but log warning.
            // Caller loop (syncStaleSessions) needs to know if it should retry with next key?
            // Actually `syncStaleSessions` passes a SINGLE apiKey currently.
            // We need to change `syncStaleSessions` to iterate keys.
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
export async function syncStaleSessions(explicitApiKey?: string) {
    // We strictly should sync based on per-profile settings, but iterating all sessions in DB
    // allows a background worker to keep everything fresh regardless of active profile.
    
    // Determine keys to use
    let apiKeys: string[] = [];
    if (explicitApiKey) {
        apiKeys = [explicitApiKey];
    } else {
        apiKeys = getApiKeys();
    }

    if (apiKeys.length === 0) {
        console.warn("No API keys configured for syncStaleSessions");
        return;
    }

    // Simplification: Use default settings for thresholds.
    const settings = await getSettings('default');

    // Optimization: Select only necessary columns and filter by time in SQL
    // to reduce memory usage and DB load.
    // Instead of fetching all potentially stale sessions and filtering in JS,
    // we use a more complex WHERE clause to only fetch sessions that actually need updating.
    const now = Date.now();
    const activeCutoff = now - settings.sessionCacheInProgressInterval * 1000;
    const pendingCutoff = now - settings.sessionCachePendingApprovalInterval * 1000;
    const completedCutoff = now - settings.sessionCacheCompletedNoPrInterval * 1000;

    // We also don't need to check sessions older than max age (approx)
    const maxAgeCutoff = now - settings.sessionCacheMaxAgeDays * 24 * 60 * 60 * 1000;
    // createTime is string ISO. Comparison works if format is standard.
    const maxAgeIso = new Date(maxAgeCutoff).toISOString();

    const cachedSessions = await db.select({
      id: sessions.id,
      state: sessions.state,
      lastUpdated: sessions.lastUpdated,
      createTime: sessions.createTime,
      isPrMerged: sessions.isPrMerged,
    })
    .from(sessions)
    .where(and(
      gt(sessions.createTime, maxAgeIso),
      or(
        // Active states: update frequently (default 60s)
        and(
            inArray(sessions.state, ['IN_PROGRESS', 'PLANNING', 'QUEUED']),
            lt(sessions.lastUpdated, activeCutoff)
        ),
        // Pending states: update less frequently (default 300s)
        and(
            inArray(sessions.state, ['AWAITING_PLAN_APPROVAL', 'AWAITING_USER_FEEDBACK']),
            lt(sessions.lastUpdated, pendingCutoff)
        ),
        // Completed: update infrequently (default 30m)
        and(
            eq(sessions.state, 'COMPLETED'),
            lt(sessions.lastUpdated, completedCutoff)
        ),
        // Fallback for other/unknown states: use pending interval
        and(
            notInArray(sessions.state, ['IN_PROGRESS', 'PLANNING', 'QUEUED', 'AWAITING_PLAN_APPROVAL', 'AWAITING_USER_FEEDBACK', 'COMPLETED']),
            lt(sessions.lastUpdated, pendingCutoff)
        )
      )
    ));

  const sessionsToUpdate: string[] = [];

  for (const session of cachedSessions) {
    // Double check specific logic that couldn't be easily put in SQL (e.g. JSON fields)

    // Check if COMPLETED sessions have merged PRs
    // Optimization: Check the optimized column instead of parsing JSON
    if (session.state === 'COMPLETED') {
         if (session.isPrMerged) {
            continue;
         }
    }

    // Since we already filtered by time/state in SQL, we can assume these need updates.
    // The createTime check is also done in SQL.
    sessionsToUpdate.push(session.id);
  }

  // Update sessions in batches/concurrency control
  const BATCH_SIZE = 5;
  for (let i = 0; i < sessionsToUpdate.length; i += BATCH_SIZE) {
    const batch = sessionsToUpdate.slice(i, i + BATCH_SIZE);
    
    // Run batch in parallel
    await Promise.all(batch.map(async (id) => {
        // Try keys until one works
        let updatedSession: Session | null = null;
        for (const key of apiKeys) {
            updatedSession = await fetchSessionFromApi(id, key);
            if (updatedSession) break;
        }

        if (updatedSession) {
             const sanitizedSession = {
                ...updatedSession,
                sourceContext: updatedSession.sourceContext || undefined,
                url: updatedSession.url || undefined,
                outputs: updatedSession.outputs || undefined,
                requirePlanApproval: updatedSession.requirePlanApproval ?? undefined,
                automationMode: updatedSession.automationMode || undefined,
             } as Session; 
            await upsertSession(sanitizedSession);
            console.log(`Successfully synced session ${id}`);
        } else {
            console.warn(`Failed to sync session ${id} with all available keys`);
        }
    }));
  }
}

/**
 * Force refresh a specific session.
 */
export async function forceRefreshSession(sessionId: string, explicitApiKey: string) {
    // Determine keys
    let apiKeys: string[] = [];
    if (explicitApiKey) {
        apiKeys = [explicitApiKey];
    } else {
        apiKeys = getApiKeys();
    }

    if (apiKeys.length === 0) {
        console.warn("No API keys for forceRefreshSession");
        return null; // Return null if no keys
    }

    let updatedSession: Session | null = null;
    for (const key of apiKeys) {
        updatedSession = await fetchSessionFromApi(sessionId, key);
        if (updatedSession) break;
    }

    if (updatedSession) {
        await upsertSession(updatedSession);
    } else {
        console.warn(`Failed to force refresh session ${sessionId} with any key`);
    }
    return updatedSession;
}
