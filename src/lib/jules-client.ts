
import type { Session, Source } from '@/lib/types';
import { fetchWithRetry } from '@/lib/fetch-client';

// Helper types
type ListSessionsResponse = {
  sessions: Session[];
  nextPageToken?: string;
};

type ListSourcesResponse = {
  sources: Source[];
  nextPageToken?: string;
};

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

export async function fetchSessionsFromApi(
  apiKey: string,
  pageSize: number = 50,
  requestId?: string
): Promise<Session[]> {
  if (process.env.MOCK_API === 'true') {
     return MOCK_SESSIONS;
  }

  try {
    const url = new URL('https://jules.googleapis.com/v1alpha/sessions');
    url.searchParams.set('pageSize', pageSize.toString());

    const response = await fetchWithRetry(
        url.toString(),
        {
            headers: {
                'X-Goog-Api-Key': apiKey,
            },
            next: { revalidate: 0 },
            requestId,
        }
    );

    if (!response.ok) {
        console.error(`Failed to fetch sessions: ${response.status} ${response.statusText}`);
        return [];
    }

    const data: ListSessionsResponse = await response.json();

    return (data.sessions || []).map(session => ({
        ...session,
        createTime: session.createTime || '',
    }));

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
}

export async function fetchSessionsPageFromApi(
    apiKey: string,
    pageToken?: string | null,
    pageSize: number = 100
): Promise<{ sessions: Session[], nextPageToken?: string }> {
     if (process.env.MOCK_API === 'true') {
        return { sessions: MOCK_SESSIONS };
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
                    'X-Goog-Api-Key': apiKey,
                },
                next: { revalidate: 0 },
            }
        );

        if (!response.ok) {
            console.error(`Failed to fetch sessions: ${response.status} ${response.statusText}`);
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

export async function fetchSessionFromApi(id: string, apiKey: string): Promise<Session | null> {
    if (process.env.MOCK_API === 'true') {
        return MOCK_SESSIONS.find(s => s.id === id) || null;
    }

    try {
        const url = `https://jules.googleapis.com/v1alpha/sessions/${id}`;
        const response = await fetchWithRetry(url, {
             headers: {
                'X-Goog-Api-Key': apiKey,
            },
            next: { revalidate: 0 }
        });

        if (!response.ok) {
             console.error(`Failed to fetch session ${id}: ${response.status}`);
             return null;
        }

        const session: Session = await response.json();
        session.createTime = session.createTime || '';
        return session;
    } catch (e) {
        console.error(`Error fetching session ${id}:`, e);
        return null;
    }
}

export async function fetchSourcesFromApi(apiKey: string): Promise<Source[]> {
  if (process.env.MOCK_API === 'true') {
    return MOCK_SOURCES;
  }

  let allSources: Source[] = [];
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
          'X-Goog-Api-Key': apiKey,
        },
        next: { revalidate: 300 },
      });

      if (!response.ok) {
        console.error(`Failed to fetch sources: ${response.status} ${response.statusText}`);
        if (allSources.length > 0) break;
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
