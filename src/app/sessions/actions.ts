
'use server';

import type { Session, Source } from '@/lib/types';
import { revalidateTag } from 'next/cache';
import { fetchWithRetry, cancelRequest } from '@/lib/fetch-client';
import { getCachedSessions, syncStaleSessions, upsertSession, forceRefreshSession } from '@/lib/session-service';
import { profileService } from '@/lib/db/profile-service';

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
  requestId?: string
): Promise<{ sessions: Session[], error?: string }> {
  // Check for mock flag
  if (process.env.MOCK_API === 'true') {
     return { sessions: MOCK_SESSIONS };
  }

  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    return { sessions: [], error: "Jules API key is not configured. Please set it in the settings." };
  }

  const activeProfile = await profileService.getActiveProfile();

  try {
    // 1. Get cached sessions from DB
    // Pass profileId to filter by profile
    let sessions = await getCachedSessions(activeProfile.id);
    const isInitialFetch = sessions.length === 0;

    // 2. If DB is empty, perform an initial fetch from API to populate it
    if (isInitialFetch) {
        console.log("Session cache is empty for this profile, performing initial fetch...");
        // Fetch the first page or so to populate.
        // NOTE: We might want to fetch *all* pages if we want a complete cache,
        // but for now let's just fetch the first page to be responsive.
        // Ideally, we should have a background job to fetch all history.
        // We reuse fetchSessionsPage logic but simplified here.
        const firstPage = await fetchSessionsPage(effectiveApiKey, null, 100);

        if (firstPage.error) {
            return { sessions: [], error: firstPage.error };
        }

        for (const s of firstPage.sessions) {
            await upsertSession(s, activeProfile.id);
        }
        sessions = await getCachedSessions(activeProfile.id);
    }

    // 3. Trigger background sync for stale sessions
    // We do not await this, so the UI is fast.
    // However, in serverless environments, this might be cut short.
    // In a long-running container (docker-compose), this is fine.
    // We catch errors to prevent crashing.
    if (!isInitialFetch) {
      (async () => {
          try {
              // We pass profileId so syncStaleSessions can fetch settings for that profile if needed,
              // or at least know which profile we are syncing.
              // Wait, syncStaleSessions iterates over *all* sessions in DB or just for this user?
              // The original implementation of syncStaleSessions iterates over stale sessions in DB.
              // If we want to sync only for this profile, we should pass profileId.
              await syncStaleSessions(effectiveApiKey, activeProfile.id);
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
    const activeProfile = await profileService.getActiveProfile();
    await forceRefreshSession(sessionId, effectiveApiKey, activeProfile.id);
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
