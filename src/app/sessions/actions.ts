
'use server';

import type { Session, Source } from '@/lib/types';
import { revalidateTag } from 'next/cache';

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
    id: 'session-1',
    title: 'Mock Session 1',
    state: 'COMPLETED',
    createTime: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    sourceContext: {
      source: 'github/test-owner/test-repo',
      githubRepoContext: {
        startingBranch: 'main',
      },
    },
  },
  {
    id: 'session-2',
    title: 'Mock Session 2',
    state: 'AWAITING_USER_FEEDBACK',
    createTime: new Date(Date.now() - 100000).toISOString(),
    createdAt: new Date(Date.now() - 100000).toISOString(),
    sourceContext: {
      source: 'github/test-owner/test-repo',
      githubRepoContext: {
        startingBranch: 'develop',
      },
    },
  },
];

const MOCK_SOURCES: Source[] = [
  {
    name: 'github/test-owner/test-repo',
    githubRepo: {
      owner: 'test-owner',
      repo: 'test-repo',
      branches: [
        { displayName: 'main' },
        { displayName: 'develop' },
      ],
      defaultBranch: { displayName: 'main' },
    },
  },
];

export async function listSessions(
  apiKey?: string | null,
  pageSize: number = 50
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
    const response = await fetch(
      `https://jules.googleapis.com/v1alpha/sessions?pageSize=${pageSize}`,
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
      return [];
    }

    const data: ListSessionsResponse = await response.json();
    
    return (data.sessions || []).map(session => ({
      ...session,
      status: session.state || 'Succeeded',
      createdAt: session.createTime || '',
    }));

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
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
  try {
    const response = await fetch('https://jules.googleapis.com/v1alpha/sources', {
      headers: {
        'X-Goog-Api-Key': effectiveApiKey,
      },
      next: { revalidate: 300, tags: ['sources'] },
    });
    if (!response.ok) {
      console.error(`Failed to fetch sources: ${response.status} ${response.statusText}`);
      return [];
    }
    const data: ListSourcesResponse = await response.json();
    return data.sources || [];
  } catch (error) {
    console.error('Error fetching sources:', error);
    return [];
  }
}

export async function refreshSources() {
  revalidateTag('sources');
}
