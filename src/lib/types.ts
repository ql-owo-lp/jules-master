export type JobStatus = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';

// Based on the Jules API documentation for a Session
export type Session = {
  name: string; // e.g., "sessions/31415926535897932384"
  id: string;
  title: string;
  prompt: string;
  // This is a simplification. The real API has a complex sourceContext.
  sourceContext?: {
    source: string;
  };
  createTime?: string; // API uses createTime
  createdAt: string; // Keep for consistency in our app
  status: JobStatus; // This is a client-side concept for now to track progress
};

export type Branch = {
  displayName: string;
};

export type GitHubRepo = {
  owner: string;
  repo: string;
  isPrivate: boolean;
  defaultBranch: Branch;
  branches: Branch[];
};

// Based on the Jules API documentation for a Source
export type Source = {
  name: string; // e.g., "sources/github/bobalover/boba"
  id: string;
  githubRepo: GitHubRepo;
};

export type PredefinedPrompt = {
  id: string;
  title: string;
  prompt: string;
};
