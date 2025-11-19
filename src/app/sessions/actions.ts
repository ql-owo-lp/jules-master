
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

function getApiKey(): string | undefined {
    // Prefer the environment variable, but fall back to a header for client-side calls.
    // In a real app, you'd want a more robust authentication strategy.
    const apiKey = process.env.JULES_API_KEY;
    return apiKey;
}

export async function revalidateSessions() {
  revalidateTag('sessions');
}

export async function getApiKeys() {
    return {
        JULES_API_KEY: !!process.env.JULES_API_KEY,
        GITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
    }
}

export async function listSessions(
  pageSize: number = 50
): Promise<Session[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
      // This happens when called from the client without the env var set.
      // The client should handle this case and use its local storage key.
      console.warn("listSessions called without JULES_API_KEY set on the server.");
      return [];
  }

  try {
    const response = await fetch(
      `https://jules.googleapis.com/v1alpha/sessions?pageSize=${pageSize}`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
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
      createdAt: session.createTime || new Date().toISOString(),
    }));

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
}

export async function listSources(): Promise<Source[]> {
  const apiKey = getApiKey();
   if (!apiKey) {
      console.warn("listSources called without JULES_API_KEY set on the server.");
      return [];
  }
  try {
    const response = await fetch('https://jules.googleapis.com/v1alpha/sources', {
      headers: {
        'X-Goog-Api-Key': apiKey,
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
