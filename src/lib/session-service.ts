
import { db } from './db';
import * as schema from './db/schema';
import { Session, State, SessionOutput } from './types';
import { eq, inArray, lt, and, desc, sql } from 'drizzle-orm';
import { fetchWithRetry } from './fetch-client';

type ListSessionsResponse = {
  sessions: Session[];
  nextPageToken?: string;
};

// Helper to convert DB session to Type Session
function mapDbSessionToSession(dbSession: typeof schema.sessions.$inferSelect): Session {
  return {
    id: dbSession.id,
    name: dbSession.name,
    title: dbSession.title,
    prompt: dbSession.prompt,
    sourceContext: dbSession.sourceContext || undefined,
    createTime: dbSession.createTime || undefined,
    updateTime: dbSession.updateTime || undefined,
    state: dbSession.state as State,
    url: dbSession.url || undefined,
    outputs: dbSession.outputs || undefined,
    requirePlanApproval: dbSession.requirePlanApproval === null ? undefined : dbSession.requirePlanApproval,
    automationMode: dbSession.automationMode || undefined,
  };
}

export async function getLocalSessions(limit: number = 100): Promise<Session[]> {
  const sessions = await db.select().from(schema.sessions).limit(limit).orderBy(desc(schema.sessions.createTime));
  return sessions.map(mapDbSessionToSession);
}

export async function getLocalSession(id: string): Promise<Session | undefined> {
  const session = await db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).get();
  return session ? mapDbSessionToSession(session) : undefined;
}

export async function updateLocalSession(session: Session) {
  const now = Date.now();
  const dbSession = {
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
    lastUpdatedAt: now,
  };

  const existing = await db.select().from(schema.sessions).where(eq(schema.sessions.id, session.id)).get();
  if (existing) {
    await db.update(schema.sessions).set(dbSession).where(eq(schema.sessions.id, session.id));
  } else {
    await db.insert(schema.sessions).values(dbSession);
  }
}

async function fetchSessionFromApi(id: string, apiKey: string): Promise<Session | null> {
  try {
    const url = `https://jules.googleapis.com/v1alpha/sessions/${id}`;
    const response = await fetchWithRetry(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(`Failed to fetch session ${id}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching session ${id}:`, error);
    return null;
  }
}

async function fetchSessionsFromApi(apiKey: string, pageSize: number = 50, pageToken?: string): Promise<ListSessionsResponse> {
    try {
        const url = new URL('https://jules.googleapis.com/v1alpha/sessions');
        url.searchParams.set('pageSize', pageSize.toString());
        if (pageToken) {
            url.searchParams.set('pageToken', pageToken);
        }

        const response = await fetchWithRetry(url.toString(), {
            headers: {
                'X-Goog-Api-Key': apiKey,
            },
            next: { revalidate: 0 },
        });

        if (!response.ok) {
             console.error(`Failed to fetch sessions list: ${response.status}`);
             return { sessions: [] };
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching sessions list:', error);
        return { sessions: [] };
    }
}


export async function syncSession(id: string, apiKey: string) {
  const session = await fetchSessionFromApi(id, apiKey);
  if (session) {
    await updateLocalSession(session);
  }
}

// Logic to check if session needs update
export async function shouldUpdateSession(session: typeof schema.sessions.$inferSelect, settings: typeof schema.settings.$inferSelect): Promise<boolean> {
  const now = Date.now();
  const lastUpdated = session.lastUpdatedAt;
  const elapsed = (now - lastUpdated) / 1000; // in seconds

  // Check 3 days rule
  const createTime = session.createTime ? new Date(session.createTime).getTime() : 0;
  const ageInDays = (now - createTime) / (1000 * 60 * 60 * 24);
  if (ageInDays > settings.sessionCacheMaxAgeDays) {
      return false; // Too old, don't update automatically
  }

  if (session.state === 'IN_PROGRESS' || session.state === 'PLANNING' || session.state === 'QUEUED') {
    return elapsed >= settings.sessionCacheInProgressInterval;
  }

  if (session.state === 'AWAITING_PLAN_APPROVAL' || session.state === 'AWAITING_USER_FEEDBACK') {
    return elapsed >= settings.sessionCachePendingApprovalInterval;
  }

  if (session.state === 'COMPLETED') {
    // Check for PR status if outputs exist
    const hasPr = session.outputs?.some(o => o.pullRequest);
    if (hasPr) {
        // If PR is merged, we stop updating. But we need to know if PR is merged.
        // The session object itself doesn't tell us if PR is merged unless we fetch the session or PR details.
        // The prompt says: "For sessions that was already compeleted, we check if the status of the PR, if it's merged, then we no longer update it."
        // Assuming the Jules API updates the session (or we fetch PR status separately).
        // If we rely on session state, we might not know.
        // For now, let's assume if it's completed and has PR, we check it less frequently or check PR status?
        // Prompt says: "For session that was 'complete' and there is no PR, we update the status with interval 30 minutes."

        // If there is a PR, we probably need to check it.
        // "For sessions that was already compeleted, we check if the status of the PR, if it's merged, then we no longer update it."
        // This implies we need to check PR status.
        // But `shouldUpdateSession` decides if we fetch the SESSION from Jules API.
        // Jules API might update session outputs if PR is merged? Or do we need to check GitHub?
        // The prompt implies we fetch session status.
        // Let's assume we update it with the same interval as "Completed no PR" if not merged, or maybe faster?
        // The prompt doesn't specify interval for "Completed with PR but not merged".
        // Let's assume standard polling or maybe the "pending approval" interval?
        // Or maybe 60s?

        // Wait, if PR is merged, we stop updating.
        // We need to store PR status in DB or infer it.
        // Current schema doesn't have PR status column.
        // Maybe we just fetch session. If session outputs update to say merged?
        // Or do we fetch PR status from GitHub?

        // Let's stick to the explicit rules:
        // 1. In Progress: 60s
        // 2. Completed + No PR: 30 mins
        // 3. Pending Approval: 300s

        // What about Completed + PR?
        // If we don't update it, we won't know if it's merged.
        // So we must update it.
        // Let's use 60s or 300s?
        return elapsed >= settings.sessionCacheInProgressInterval; // Conservative approach: treat as active until we know it's merged.
    } else {
        return elapsed >= settings.sessionCacheCompletedNoPrInterval;
    }
  }

  // Default for other states (PAUSED, FAILED)
  return elapsed >= settings.sessionCacheCompletedNoPrInterval;
}

export async function updateStaleSessions(apiKey: string) {
    const settingsList = await db.select().from(schema.settings).limit(1);
    const appSettings = settingsList[0];
    if (!appSettings) return;

    // Get all sessions
    const allSessions = await db.select().from(schema.sessions);

    // Filter stale sessions
    const staleSessions = [];
    for (const session of allSessions) {
        if (await shouldUpdateSession(session, appSettings)) {
            staleSessions.push(session);
        }
    }

    // Sort by last updated (update oldest first)
    staleSessions.sort((a, b) => a.lastUpdatedAt - b.lastUpdatedAt);

    // Update in batches (e.g. 5 at a time) to avoid rate limit
    const batchSize = 5;
    const batch = staleSessions.slice(0, batchSize);

    await Promise.all(batch.map(s => syncSession(s.id, apiKey)));
}

export async function syncAllSessions(apiKey: string) {
    // Initial sync or manual refresh
    let pageToken: string | undefined = undefined;
    do {
        const response: ListSessionsResponse = await fetchSessionsFromApi(apiKey, 50, pageToken);
        const sessions = response.sessions || [];

        // Bulk upsert or sequential upsert
        for (const session of sessions) {
             await updateLocalSession(session);
        }

        pageToken = response.nextPageToken;
    } while (pageToken);
}
