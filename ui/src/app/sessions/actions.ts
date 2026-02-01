
'use server';

import type { Session, Source } from '@/lib/types';
import { revalidateTag } from 'next/cache';
import { fetchWithRetry, cancelRequest } from '@/lib/fetch-client';
import { getCachedSessions, syncStaleSessions, upsertSession, forceRefreshSession } from '@/lib/session-service';
import { getApiKeys } from '@/lib/config';

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _pageSize: number = 50,
  requestId?: string,
  profileId: string = 'default'
): Promise<{ sessions: Session[], error?: string }> {
  if (process.env.MOCK_API === 'true' && process.env.HYBRID_MOCK !== 'true') {
     return { sessions: MOCK_SESSIONS };
  }

  // Determine keys
  let apiKeys: string[] = [];
  if (apiKey) {
      apiKeys = [apiKey];
  } else {
      apiKeys = getApiKeys();
  }

  if (apiKeys.length === 0) {
    return { sessions: [], error: "Jules API key is not configured. Please set it in the settings." };
  }

  try {
    // 1. Get cached sessions from DB
    let sessions = await getCachedSessions(profileId);
    const isInitialFetch = sessions.length === 0;

    // 2. If DB is empty, perform an initial fetch from API to populate it
    if (isInitialFetch) {
        console.log("Session cache is empty, performing initial fetch from all keys...");
        
        // Fetch from all keys and merge in DB
        const errors: string[] = [];
        for (const key of apiKeys) {
            const firstPage = await fetchSessionsPage(key, null, 100);
            if (firstPage.error) {
                console.warn(`Failed to fetch sessions for key ...${key.slice(-4)}: ${firstPage.error}`);
                errors.push(firstPage.error);
                continue;
            }
            for (const s of firstPage.sessions) {
                s.profileId = profileId;
                await upsertSession(s); 
            }
        }
        
        // If all failed, return error. If at least one succeeded, we show partial results.
        if (errors.length === apiKeys.length && errors.length > 0) {
             return { sessions: [], error: errors[0] }; // Return first error
        }
        sessions = await getCachedSessions(profileId);
    }

    // 3. Trigger background sync for stale sessions
    if (!isInitialFetch) {
      (async () => {
          try {
              // passing undefined lets it use all keys
              await syncStaleSessions(apiKey || undefined); 
          } catch (e) {
              console.error("Background session sync failed", e);
          }
      })();
    }

    return { sessions };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            const errorText = `Failed to fetch sessions from ${url.toString()}: ${response.status} ${response.statusText}`;
            console.error(errorText);
            const errorBody = await response.text();
            console.error('Error body:', errorBody);
            // Include status code in error message for easier identification
            return { sessions: [], error: `${errorText}. ${errorBody ? 'Details in logs.' : ''}` };
        }

        const data: ListSessionsResponse = await response.json();

        const sessions = (data.sessions || []).map(session => {
            let id = session.id;
            if (!id && session.name) {
                const parts = session.name.split('/');
                if (parts.length > 1) {
                    id = parts[parts.length - 1];
                }
            }
            return {
                ...session,
                id,
                createTime: session.createTime || '',
                sourceContext: session.sourceContext || undefined,
                state: session.state || 'STATE_UNSPECIFIED',
                url: session.url || undefined,
                outputs: session.outputs || undefined,
                requirePlanApproval: session.requirePlanApproval ?? undefined,
                automationMode: session.automationMode || undefined,
            };
        });

        return { sessions, nextPageToken: data.nextPageToken };

     // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Determine keys
  let apiKeys: string[] = [];
  if (apiKey) {
      apiKeys = [apiKey];
  } else {
      apiKeys = getApiKeys();
  }

  if (apiKeys.length === 0) {
    console.error("Jules API key is not configured.");
    return [];
  }

  let allSources: Source[] = [];
  const sourceIds = new Set<string>();

  for (const key of apiKeys) {
      // We fetch sources for each key and merge
      // Pagination needs to be handled PER KEY.
      let keySources: Source[] = [];
      let nextPageToken: string | undefined | null = null;
      
      try {
        do {
        const url = new URL('https://jules.googleapis.com/v1alpha/sources');
        url.searchParams.set('pageSize', '100');
        if (nextPageToken) {
            url.searchParams.set('pageToken', nextPageToken);
        }

        const response = await fetchWithRetry(url.toString(), {
            headers: {
            'X-Goog-Api-Key': key,
            },
            next: { revalidate: 300, tags: ['sources'] },
        });

        if (!response.ok) {
            console.warn(`Failed to fetch sources for key ...${key.slice(-4)}: ${response.status} ${response.statusText}`);
            // Don't abort other keys
            break; 
        }

        const data: ListSourcesResponse = await response.json();
        if (data.sources) {
            keySources = [...keySources, ...data.sources];
        }
        nextPageToken = data.nextPageToken;
        } while (nextPageToken);
        
        // Merge into allSources
        for (const s of keySources) {
            if (!sourceIds.has(s.id)) {
                sourceIds.add(s.id);
                allSources.push(s);
            }
        }

      } catch (error) {
        console.error(`Error fetching sources for key ...${key.slice(-4)}:`, error);
      }
  }

  return allSources;
}

export async function refreshSources() {
  revalidateTag('sources');
}
