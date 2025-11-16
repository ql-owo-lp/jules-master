'use server';

import type { Session, Source, Branch } from '@/lib/types';

type ListSessionsResponse = {
  sessions: Session[];
  nextPageToken?: string;
};

type ListSourcesResponse = {
  sources: Source[];
  nextPageToken?: string;
};

type ListBranchesResponse = {
  branches: Branch[];
  nextPageToken?: string;
};

export async function listSessions(
  apiKey: string
): Promise<Session[]> {
  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch(
      'https://jules.googleapis.com/v1alpha/sessions?pageSize=20',
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
        },
        cache: 'no-store', // Ensure we get fresh data
      }
    );

    if (!response.ok) {
      // Log the error for debugging, but return an empty array to the client
      console.error(`Failed to fetch sessions: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error('Error body:', errorBody);
      return [];
    }

    const data: ListSessionsResponse = await response.json();
    
    // The API doesn't provide a status, so we'll default to 'Succeeded' for now.
    // And it seems `createTime` is what we should use for `createdAt`.
    return (data.sessions || []).map(session => ({
      ...session,
      status: 'Succeeded',
      createdAt: session.createTime || new Date().toISOString(),
    }));

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return [];
  }
}

export async function listSources(apiKey: string): Promise<Source[]> {
  if (!apiKey) {
    return [];
  }
  try {
    const response = await fetch('https://jules.googleapis.com/v1alpha/sources', {
      headers: {
        'X-Goog-Api-Key': apiKey,
      },
      cache: 'no-store',
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


export async function listBranches(apiKey: string, sourceName: string): Promise<Branch[]> {
  if (!apiKey || !sourceName) {
    return [];
  }
  try {
    const response = await fetch(`https://jules.googleapis.com/v1alpha/${sourceName}:listBranches`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      console.error(`Failed to fetch branches: ${response.status} ${response.statusText}`);
      return [];
    }
    const data: ListBranchesResponse = await response.json();
    return data.branches || [];
  } catch (error) {
    console.error('Error fetching branches:', error);
    return [];
  }
}
