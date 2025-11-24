
'use server';

import type { Session, Source } from '@/lib/types';
import { revalidateTag } from 'next/cache';
import { cancelRequest } from '@/lib/fetch-client';
import { getAllSessions, syncStaleSessions, upsertSession } from '@/lib/session-service';
import { fetchSessionsPageFromApi, fetchSessionFromApi, fetchSourcesFromApi } from '@/lib/jules-client';

export async function revalidateSessions() {
  revalidateTag('sessions');
}

export async function cancelSessionRequest(requestId: string) {
  cancelRequest(requestId);
}

export async function listSessions(
  apiKey?: string | null,
  pageSize: number = 50,
  requestId?: string
): Promise<Session[]> {
  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    console.error("Jules API key is not configured.");
    return [];
  }

  try {
    // 1. Fetch from local DB
    const cachedSessions = await getAllSessions();

    // 2. Handle Cold Start: If DB is empty, fetch immediately from API
    if (cachedSessions.length === 0) {
        console.log("Cold start: Fetching sessions from API...");
        const apiResponse = await fetchSessionsPageFromApi(effectiveApiKey, undefined, pageSize);
        const apiSessions = apiResponse.sessions;

        if (apiSessions.length > 0) {
            // Save to DB
            // Note: We don't await upsert to return fast? No, we should return the data we just fetched.
            // But we should also cache it.
            // To ensure consistency, let's cache and return.
            // Since `upsertSessions` might take time, maybe we return first and upsert in background?
            // Next.js actions might terminate. Safe to await.
            // Or use `waitUntil` if available (Vercel specific).
            // Let's await. SQLite is fast.
            await import('@/lib/session-service').then(m => m.upsertSessions(apiSessions));
            return apiSessions;
        }
        return [];
    }

    // 3. Trigger background sync for stale sessions (if we have data)
    // We don't await this, so we return cached data immediately
    // Note: In serverless, this might be cut off. In container, it's safer.
    syncStaleSessions(effectiveApiKey).catch(err => console.error("Background sync failed:", err));

    return cachedSessions;

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
}

export async function fetchSession(id: string, apiKey?: string | null): Promise<Session | null> {
    const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
    if (!effectiveApiKey) return null;

    // Use the client which now handles API call
    const session = await fetchSessionFromApi(id, effectiveApiKey);

    if (session) {
        await upsertSession(session);
    }
    return session;
}

export async function fetchSessionsPage(
    apiKey?: string | null,
    pageToken?: string | null,
    pageSize: number = 100
): Promise<{ sessions: Session[], nextPageToken?: string }> {
     const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
     if (!effectiveApiKey) {
       console.error("Jules API key is not configured.");
       return { sessions: [] };
     }

     return fetchSessionsPageFromApi(effectiveApiKey, pageToken, pageSize);
}

export async function listSources(apiKey?: string | null): Promise<Source[]> {
  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    console.error("Jules API key is not configured.");
    return [];
  }

  return fetchSourcesFromApi(effectiveApiKey);
}

export async function refreshSources() {
  revalidateTag('sources');
}
