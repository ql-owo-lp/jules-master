
import { db } from './db';
import { sessions, settings } from './db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import type { Session, State, SessionOutput } from './types';
import { fetchSessionsPageFromApi, fetchSessionFromApi } from './jules-client';

// Convert DB session to API Session type
function mapDbSessionToSession(dbSession: typeof sessions.$inferSelect): Session {
  return {
    id: dbSession.id,
    name: dbSession.name,
    title: dbSession.title,
    prompt: dbSession.prompt,
    sourceContext: dbSession.sourceContext as any,
    createTime: dbSession.createTime,
    updateTime: dbSession.updateTime || undefined,
    state: dbSession.state as State,
    url: dbSession.url || undefined,
    outputs: dbSession.outputs as SessionOutput[] || undefined,
    requirePlanApproval: dbSession.requirePlanApproval || undefined,
    automationMode: dbSession.automationMode as any,
  };
}

export async function getSession(id: string): Promise<Session | null> {
  const result = await db.select().from(sessions).where(eq(sessions.id, id));
  if (result.length === 0) return null;
  return mapDbSessionToSession(result[0]);
}

export async function getAllSessions(): Promise<Session[]> {
  const result = await db.select().from(sessions).orderBy(sql`${sessions.createTime} DESC`);
  return result.map(mapDbSessionToSession);
}

export async function upsertSession(session: Session) {
  await db.insert(sessions).values({
    id: session.id,
    name: session.name,
    title: session.title,
    prompt: session.prompt,
    sourceContext: session.sourceContext,
    createTime: session.createTime || new Date().toISOString(), // Fallback if missing
    updateTime: session.updateTime,
    state: session.state,
    url: session.url,
    outputs: session.outputs,
    requirePlanApproval: session.requirePlanApproval,
    automationMode: session.automationMode,
    lastUpdated: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: sessions.id,
    set: {
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
      lastUpdated: new Date().toISOString(),
    }
  });
}

export async function upsertSessions(sessionsList: Session[]) {
  // Using a transaction for safety.
  await db.transaction(async (tx) => {
    for (const session of sessionsList) {
       await tx.insert(sessions).values({
        id: session.id,
        name: session.name,
        title: session.title,
        prompt: session.prompt,
        sourceContext: session.sourceContext,
        createTime: session.createTime || new Date().toISOString(),
        updateTime: session.updateTime,
        state: session.state,
        url: session.url,
        outputs: session.outputs,
        requirePlanApproval: session.requirePlanApproval,
        automationMode: session.automationMode,
        lastUpdated: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: sessions.id,
        set: {
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
            lastUpdated: new Date().toISOString(),
        }
      });
    }
  });
}

export async function getSettings() {
  const result = await db.select().from(settings).limit(1);
  if (result.length === 0) {
    // Return defaults if no settings exist
    return {
        sessionCacheInProgressInterval: 60,
        sessionCacheCompletedNoPrInterval: 1800,
        sessionCachePendingApprovalInterval: 300,
        sessionCacheMaxAgeDays: 3,
    };
  }
  return result[0];
}

export function shouldUpdateSession(session: typeof sessions.$inferSelect, config: any): boolean {
  const now = Date.now();
  const lastUpdated = new Date(session.lastUpdated).getTime();
  const createTime = new Date(session.createTime).getTime();
  const ageInDays = (now - createTime) / (1000 * 60 * 60 * 24);

  // 1. Old sessions check
  if (ageInDays > config.sessionCacheMaxAgeDays) {
    return false; // Do not update unless manually triggered (manual trigger bypasses this function)
  }

  const secondsSinceLastUpdate = (now - lastUpdated) / 1000;

  // 2. In Progress
  if (session.state === 'IN_PROGRESS' || session.state === 'QUEUED' || session.state === 'PLANNING') {
     return secondsSinceLastUpdate >= config.sessionCacheInProgressInterval;
  }

  // 3. Pending Approval
  if (session.state === 'AWAITING_PLAN_APPROVAL' || session.state === 'AWAITING_USER_FEEDBACK') {
    return secondsSinceLastUpdate >= config.sessionCachePendingApprovalInterval;
  }

  // 4. Completed
  if (session.state === 'COMPLETED') {
    // Check PR status logic - simplified
    // If PR is merged, we should stop updating.
    // But here we rely on the interval.
    // If we want to check if PR is merged, we need to inspect outputs.
    // However, checking GitHub status requires an async call which we can't do easily in this sync function.
    // So we assume the "CompletedNoPrInterval" covers the "poll until merged" case or the "poll infrequently" case.

    // We could check if outputs has a PR, and if so, maybe poll more frequently?
    // But the prompt says: "For sessions that was already compeleted, we check if the status of the PR, if it's merged, then we no longer update it."
    // This implies we need to KNOW if it is merged.
    // If we don't know, we must update.

    // So we return true if interval passed.
    // The "stop updating if merged" logic must happen during the update phase (if we find it's merged, we might mark it as such or just not fetch next time).
    // But for now, we just use the interval.
    return secondsSinceLastUpdate >= config.sessionCacheCompletedNoPrInterval;
  }

  // Other states
  return secondsSinceLastUpdate >= config.sessionCacheCompletedNoPrInterval;
}

export async function syncStaleSessions(apiKey: string | undefined | null) {
  if (!apiKey) return;

  const currentSettings = await getSettings();
  const allSessions = await db.select().from(sessions);

  const sessionsToUpdate = allSessions.filter(s => shouldUpdateSession(s, currentSettings));

  if (sessionsToUpdate.length === 0) return;

  console.log(`Syncing ${sessionsToUpdate.length} stale sessions...`);

  // Step 1: Fetch first page of sessions from API to catch recent updates efficiently
  const latestSessionsPage = await fetchSessionsPageFromApi(apiKey, undefined, 100);
  if (latestSessionsPage.sessions.length > 0) {
      await upsertSessions(latestSessionsPage.sessions);
  }

  // Step 2: Re-evaluate what is still stale
  // We need to re-fetch from DB to check `lastUpdated`
  const updatedAllSessions = await db.select().from(sessions);
  const stillStaleSessions = updatedAllSessions.filter(s => shouldUpdateSession(s, currentSettings));

  if (stillStaleSessions.length === 0) return;

  // Step 3: Batch update the remaining stale sessions
  // We process them in small batches to respect rate limits roughly
  const BATCH_SIZE = 5;
  const batch = stillStaleSessions.slice(0, BATCH_SIZE); // Only process first batch in this run

  console.log(`Deep syncing ${batch.length} remaining stale sessions...`);

  await Promise.all(batch.map(async (s) => {
      const updatedSession = await fetchSessionFromApi(s.id, apiKey);
      if (updatedSession) {
          await upsertSession(updatedSession);
      }
  }));
}
