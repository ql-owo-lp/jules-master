import { sessionClient, settingsClient } from './rpc-client';
import { Session, Settings } from './proto/jules';
import type { Session as LegacySession, SessionOutput, SourceContext } from '@/lib/types';

// Type definitions for easier usage
export type CachedSession = LegacySession;

/**
 * Gets the current application settings.
 */
export async function getSettings(profileId: string = 'default'): Promise<any> {
  const settings = await settingsClient.getSettings({ profileId });
  return {
    ...settings,
    autoApprovalEnabled: settings.autoApprovalEnabled,
    // Provide defaults for legacy fields if they are missing in proto or named differently
    // For now assuming direct compatibility or 'any' return satisfies callers
  };
}

/**
 * Saves or updates a session in the local database.
 */
export async function upsertSession(session: LegacySession) {
  const protoSession: Session = {
    id: session.id,
    name: session.name,
    title: session.title,
    prompt: session.prompt,
    sourceContext: session.sourceContext ? JSON.stringify(session.sourceContext) : "",
    createTime: session.createTime || "",
    updateTime: session.updateTime || "",
    state: session.state || 'STATE_UNSPECIFIED',
    url: session.url || "",
    outputs: session.outputs ? JSON.stringify(session.outputs) : "",
    requirePlanApproval: session.requirePlanApproval ?? false,
    automationMode: session.automationMode || "",
    // lastUpdated: Use Date.now() if missing from LegacySession (which it is)
    lastUpdated: (session as any).lastUpdated || Date.now(),
    retryCount: session.retryCount || 0,
    lastError: session.lastError || "",
    lastInteractionAt: session.lastInteractionAt || 0,
    profileId: session.profileId || "default",
  };

  await sessionClient.createSession({ session: protoSession });
}

/**
 * Updates the last interaction timestamp for a session.
 */
export async function updateSessionInteraction(sessionId: string) {
    const session = await sessionClient.getSession({ id: sessionId });
    session.lastInteractionAt = Date.now();
    await sessionClient.createSession({ session });
}

/**
 * Retrieves all sessions from the local database, sorted by creation time descending.
 */
export async function getCachedSessions(profileId: string = 'default'): Promise<LegacySession[]> {
  const response = await sessionClient.listSessions({ profileId });
  
  return response.sessions.map((s: Session) => ({
    id: s.id,
    name: s.name,
    title: s.title,
    prompt: s.prompt,
    sourceContext: s.sourceContext ? JSON.parse(s.sourceContext) as SourceContext : undefined,
    createTime: s.createTime,
    updateTime: s.updateTime,
    state: s.state as any,
    url: s.url,
    outputs: s.outputs ? JSON.parse(s.outputs) as SessionOutput[] : undefined,
    requirePlanApproval: s.requirePlanApproval,
    automationMode: s.automationMode as any,
    lastUpdated: s.lastUpdated,
    retryCount: s.retryCount,
    lastError: s.lastError,
    lastInteractionAt: s.lastInteractionAt,
    profileId: s.profileId,
  } as unknown as LegacySession));
}

export function isPrMerged(session: LegacySession): boolean {
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

export async function syncStaleSessions(apiKey: string) {
    console.log("syncStaleSessions: delegated to Go backend");
}

export async function forceRefreshSession(sessionId: string, apiKey: string) {
    // For now, fetch from backend via getSession which returns fresh data if backend is doing its job
    const session = await sessionClient.getSession({ id: sessionId });
    // Map to LegacySession
    return {
        id: session.id,
        name: session.name,
        title: session.title,
        prompt: session.prompt,
        sourceContext: session.sourceContext ? JSON.parse(session.sourceContext) : undefined,
        createTime: session.createTime,
        updateTime: session.updateTime,
        state: session.state,
        url: session.url,
        outputs: session.outputs ? JSON.parse(session.outputs) : undefined,
        requirePlanApproval: session.requirePlanApproval,
        automationMode: session.automationMode,
        lastUpdated: session.lastUpdated,
        retryCount: session.retryCount,
        lastError: session.lastError,
        lastInteractionAt: session.lastInteractionAt,
        profileId: session.profileId,
    } as unknown as LegacySession;
}
