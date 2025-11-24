
'use server';

import type { Session, Source } from '@/lib/types';
import { revalidateTag } from 'next/cache';
import { fetchWithRetry, cancelRequest } from '@/lib/fetch-client';
import { getLocalSessions, updateStaleSessions, syncAllSessions } from '@/lib/session-service';

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
    createTime: new Date().toISOString(),
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
    createTime: new Date(Date.now() - 100000).toISOString(),
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
): Promise<Session[]> {
  // Check for mock flag
  if (process.env.MOCK_API === 'true') {
     return MOCK_SESSIONS;
  }

  const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
  if (!effectiveApiKey) {
    console.error("Jules API key is not configured.");
    return [];
  }

  try {
    // 1. Get cached sessions from DB
    const localSessions = await getLocalSessions(pageSize);

    // 2. Trigger background update for stale sessions
    // We don't await this so the UI response is fast.
    // However, in Vercel/Serverless environment, this might be terminated.
    // In a long-running container (which seems to be the case here), this works.
    updateStaleSessions(effectiveApiKey).catch(err =>
        console.error("Failed to update stale sessions in background", err)
    );

    // If local DB is empty, maybe we should do an initial sync?
    if (localSessions.length === 0) {
        console.log("Local session cache empty, performing initial sync...");
        await syncAllSessions(effectiveApiKey);
        return getLocalSessions(pageSize);
    }

    return localSessions;

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
}

// New action to force sync all sessions (e.g. user clicks refresh)
export async function forceSyncSessions(apiKey?: string | null) {
     const effectiveApiKey = apiKey || process.env.JULES_API_KEY;
     if (!effectiveApiKey) return;

     await syncAllSessions(effectiveApiKey);
     revalidateTag('sessions');
}

export async function fetchSessionsPage(
    apiKey?: string | null,
    pageToken?: string | null,
    pageSize: number = 100
): Promise<{ sessions: Session[], nextPageToken?: string }> {
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
            }
        );

        if (!response.ok) {
            console.error(`Failed to fetch sessions: ${response.status} ${response.statusText}`);
            const errorBody = await response.text();
            console.error('Error body:', errorBody);
            return { sessions: [] };
        }

        const data: ListSessionsResponse = await response.json();

        const sessions = (data.sessions || []).map(session => ({
            ...session,
            createTime: session.createTime || '',
        }));

        return { sessions, nextPageToken: data.nextPageToken };

     } catch (error) {
        console.error('Error fetching sessions page:', error);
        return { sessions: [] };
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
