
'use server';

import type { Session, Source } from '@/lib/types';
import { revalidateTag } from 'next/cache';
import { fetchWithRetry, cancelRequest } from '@/lib/fetch-client';
import { getCachedSessions, syncStaleSessions, upsertSession, forceRefreshSession } from '@/lib/session-service';

type ListSessionsResponse = {
  sessions: Session[];
  nextPageToken?: string;
};

type ListSourcesResponse = {
  sources: Source[];
  nextPageToken?: string;
};

export async function revalidateSessions() {
  revalidateTag('sessions');
}

// --- Mock Data ---
const MOCK_SESSIONS: Session[] = [
  {
    name: 'sessions/mock-1',
    id: 'session-1',
    title: 'Mock Session 1',
    state: 'COMPLETED',
    createTime: '2024-01-01T12:00:00.000Z',
    sourceContext: {
      source: 'sources/github/test-owner/test-repo',
      githubRepoContext: {
        startingBranch: 'main',
      },
    },
    prompt: "This is a mock prompt for session 1",
  },
  {
    name: 'sessions/mock-2',
    id: 'session-2',
    title: 'Mock Session 2',
    state: 'AWAITING_USER_FEEDBACK',
    createTime: '2024-01-01T11:58:20.000Z',
    sourceContext: {
      source: 'sources/github/test-owner/test-repo',
      githubRepoContext: {
        startingBranch: 'develop',
      },
    },
    prompt: "This is a mock prompt for session 2",
  },
];

const MOCK_SOURCES: Source[] = [
  {
    name: 'sources/github/test-owner/test-repo',
    id: 'source-1',
    githubRepo: {
      owner: 'test-owner',
      repo: 'test-repo',
      isPrivate: false,
      branches: [
        { displayName: 'main' },
        { displayName: 'develop' },
      ],
      defaultBranch: { displayName: 'main' },
    },
  },
];

export async function cancelSessionRequest(requestId: string) {
  cancelRequest(requestId);
}

export async function listSessions(
  apiKey?: string | null,
  pageSize: number = 50,
  requestId?: string,
  profileId?: string
): Promise<{ sessions: Session[], error?: string }> {
  // Check for mock flag
  if (process.env.MOCK_API === 'true') {
     return { sessions: MOCK_SESSIONS };
  }

  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    return { sessions: [], error: "Jules API key is not configured. Please set it in the settings." };
  }

  try {
    // 1. Get cached sessions from DB, filtered by profileId if provided
    // Wait, getCachedSessions in lib/session-service.ts likely needs profileId too.
    // I need to update session-service.ts as well.
    let sessions = await getCachedSessions(profileId);

    // Note: If we are switching profiles, the cache for that profile might be empty initially.
    // But getCachedSessions should return what is in DB for that profile.

    // 2. Initial fetch logic.
    // The previous logic was: if sessions.length === 0, fetch from API.
    // This logic is tricky with profiles. If I have a new profile, it has 0 sessions in DB.
    // So it will fetch from API.
    // BUT the API returns ALL sessions for the user (API key). It doesn't know about profiles.
    // So if I fetch from API, I get a list of sessions.
    // Do I assign them to the current profile?
    // If I have 2 profiles, and I switch to profile 2 (empty), it fetches all sessions and assigns them to profile 2?
    // Then I have duplicates in DB? (Same session ID, different profile ID? Session ID is PK).

    // If Session ID is PK, a session can only belong to ONE profile.
    // So if I fetch sessions from API, they might already exist in DB assigned to Profile 1.
    // If I upsert them with Profile 2, I "steal" them from Profile 1.

    // The requirement says: "allow user to have multiple "profiles" of settings... convert the settings / jobs/ everything to be aware of user / profile."
    // "different user can log in with their own credential, then they can have their own settings / prompts etc."

    // If different profiles use DIFFERENT API keys, then the sessions fetched will be different (or same if shared).
    // If they use SAME API key, the sessions are the same.
    // If sessions are shared on the backend (Jules API), but we want to segregate them in UI?
    // Or does "profile" imply isolation?
    // If I use the same API key in 2 profiles, do I expect to see the same sessions?
    // Or do I expect to see only sessions created by this profile?

    // If I create a session in Profile 1, it has `profileId=1`.
    // If I switch to Profile 2 (same API key), should I see it?
    // If I fetch from API, I see it.
    // If I store it in DB with `profileId=2`, I overwrite `profileId=1`.

    // Given the requirement "convert... everything to be aware of user / profile", it suggests strict isolation.
    // If I use the same credentials, I might see everything on the API side.
    // But locally, maybe we only show sessions that belong to the profile.

    // However, `listSessions` fetches from API if cache is empty.
    // If I fetch from API, I get sessions that might belong to other profiles.
    // If I upsert them, I need to decide which profile they belong to.

    // If a session already exists in DB, it has a profile ID.
    // If I fetch it again using Profile 2's API key (which happens to be the same), and I update it,
    // should I change the profile ID?

    // Ideally, sessions created via API directly (not via this app) or via other profiles shouldn't automatically appear
    // unless we decide they belong to the current profile.
    // BUT, if I just started the app with a fresh DB, I want to see my existing sessions.
    // They should probably be imported into the current profile.

    // Strategy:
    // 1. `listSessions` fetches from DB filtered by `profileId`.
    // 2. Background sync (`syncStaleSessions` or initial fetch) fetches from API.
    // 3. When fetching from API, for each session:
    //    - Check if it exists in DB.
    //    - If exists: Keep existing `profileId`? Or update to current?
    //      - If I keep existing, and it belongs to another profile, then Profile 2 won't see it even if the API key has access.
    //      - If I update to current, Profile 1 loses it.
    //    - If not exists: Insert with current `profileId`.

    // If the intention is multi-user, usually users don't share API keys.
    // If they share API keys, they share access.
    // If I want to support "Profile A sees Session A" and "Profile B sees Session B", but they share API key,
    // then the API must return all sessions.
    // Filtering must happen on client/DB.
    // But how do we know which session belongs to which profile if they share API key?
    // Only by tracking creation.
    // But for existing sessions imported from API?

    // Let's assume:
    // - New sessions created via UI get `profileId`.
    // - Sessions fetched from API that don't exist in DB get assigned to the CURRENT profile (import).
    // - Sessions fetched from API that DO exist in DB keep their `profileId`.

    // This means if I have Profile 1 and Profile 2.
    // I start in Profile 1. It fetches all sessions from API. All get assigned to Profile 1.
    // I switch to Profile 2. It shows empty list (filtered by Profile 2).
    // It tries to fetch from API. It gets all sessions.
    // It sees they exist in DB (Profile 1). It does NOT update profileId.
    // So Profile 2 sees nothing.

    // Is this desired?
    // If I want Profile 2 to be a separate workspace, yes.
    // If I want Profile 2 to just be a different "view" or "settings config" but share data, then no.

    // The requirement: "allows user to have multiple "profiles" of settings... convert the settings / jobs/ everything to be aware of user / profile."
    // This sounds like isolation.
    // So "Profile 2 sees nothing" is probably correct behavior for shared API key scenario,
    // UNLESS the user explicitly wants to move/share sessions.

    // But if I use DIFFERENT API keys, then API returns different sessions (presumably).
    // Then there is no conflict.

    // So the strategy: "Import new/unknown sessions into current profile" seems safe.

    const isInitialFetch = sessions.length === 0;

    if (isInitialFetch) {
        console.log("Session cache is empty for this profile (or globally?), checking API...");
        // We fetch from API.
        const firstPage = await fetchSessionsPage(effectiveApiKey, null, 100);

        if (firstPage.error) {
            return { sessions: [], error: firstPage.error };
        }

        for (const s of firstPage.sessions) {
            // upsertSession needs to know current profileId to assign if new.
            await upsertSession(s, profileId);
        }

        // Re-fetch from DB after upsert
        sessions = await getCachedSessions(profileId);
    }

    if (!isInitialFetch) {
      (async () => {
          try {
              await syncStaleSessions(effectiveApiKey, profileId);
          } catch (e) {
              console.error("Background session sync failed", e);
          }
      })();
    }

    return { sessions };

  } catch (error: any) {
    console.error('Error in listSessions:', error);
    return { sessions: [], error: error.message || 'Unknown error occurred in listSessions' };
  }
}

export async function refreshSession(sessionId: string, apiKey?: string | null) {
     const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
      if (!effectiveApiKey) {
        console.error("Jules API key is not configured.");
        return;
      }
    await forceRefreshSession(sessionId, effectiveApiKey);
}

export async function fetchSessionsPage(
    apiKey?: string | null,
    pageToken?: string | null,
    pageSize: number = 100
): Promise<{ sessions: Session[], nextPageToken?: string, error?: string }> {
     // Check for mock flag
     if (process.env.MOCK_API === 'true') {
        return { sessions: MOCK_SESSIONS };
     }

     const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
     if (!effectiveApiKey) {
       console.error("Jules API key is not configured.");
       return { sessions: [] };
     }

     try {
        const url = new URL('https://jules.googleapis.com/v1alpha/sessions');
        url.searchParams.set('pageSize', pageSize.toString());
        if (pageToken) {
            url.searchParams.set('pageToken', pageToken);
        }

        const response = await fetchWithRetry(
            url.toString(),
            {
                headers: {
                    'X-Goog-Api-Key': effectiveApiKey,
                },
                next: { revalidate: 0, tags: ['sessions'] },
                backoff: 5000,
            }
        );

        if (!response.ok) {
            const errorText = `Failed to fetch sessions: ${response.status} ${response.statusText}`;
            console.error(errorText);
            const errorBody = await response.text();
            console.error('Error body:', errorBody);
            // Include status code in error message for easier identification
            return { sessions: [], error: `${errorText}. ${errorBody ? 'Details in logs.' : ''}` };
        }

        const data: ListSessionsResponse = await response.json();

        const sessions = (data.sessions || []).map(session => ({
            ...session,
            createTime: session.createTime || '',
        }));

        return { sessions, nextPageToken: data.nextPageToken };

     } catch (error: any) {
        console.error('Error fetching sessions page:', error);
        return { sessions: [], error: error.message || 'Unknown error fetching sessions' };
     }
}

export async function listSources(apiKey?: string | null): Promise<Source[]> {
  // Check for mock flag
  if (process.env.MOCK_API === 'true') {
    return MOCK_SOURCES;
  }

  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    console.error("Jules API key is not configured.");
    return [];
  }

  let allSources: Source[] = [];
  let nextPageToken: string | undefined | null = null;

  try {
    do {
      const url = new URL('https://jules.googleapis.com/v1alpha/sources');
      // Set a page size to avoid fetching too many or too few if the API supports it
      url.searchParams.set('pageSize', '100');
      if (nextPageToken) {
        url.searchParams.set('pageToken', nextPageToken);
      }

      const response = await fetchWithRetry(url.toString(), {
        headers: {
          'X-Goog-Api-Key': effectiveApiKey,
        },
        next: { revalidate: 300, tags: ['sources'] },
      });

      if (!response.ok) {
        console.error(`Failed to fetch sources: ${response.status} ${response.statusText}`);
        // If we have some sources, return them, otherwise return empty
        if (allSources.length > 0) {
          break;
        }
        return [];
      }

      const data: ListSourcesResponse = await response.json();
      if (data.sources) {
        allSources = [...allSources, ...data.sources];
      }
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    return allSources;
  } catch (error) {
    console.error('Error fetching sources:', error);
    return [];
  }
}

export async function refreshSources() {
  revalidateTag('sources');
}
