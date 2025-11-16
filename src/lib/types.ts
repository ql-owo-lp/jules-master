export type JobStatus = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';

// Based on the Jules API documentation for a Session
export type Session = {
  name: string; // e.g., "sessions/31415926535897932384"
  id: string;
  title: string;
  prompt: string;
  sourceContext?: SourceContext;
  createTime?: string; // API uses createTime
  updateTime?: string;
  createdAt: string; // Keep for consistency in our app
  status: JobStatus | State; // This is a client-side concept for now to track progress
  state?: State;
  url?: string;
  outputs?: SessionOutput[];
  requirePlanApproval?: boolean;
  automationMode?: AutomationMode;
};

export type SourceContext = {
  source: string;
  githubRepoContext?: GitHubRepoContext;
};

export type GitHubRepoContext = {
  startingBranch: string;
};

export type SessionOutput = {
  pullRequest?: PullRequest;
};

export type PullRequest = {
  url: string;
  title: string;
  description: string;
};

export type AutomationMode = 'AUTOMATION_MODE_UNSPECIFIED' | 'AUTO_CREATE_PR';

export type State =
  | 'STATE_UNSPECIFIED'
  | 'QUEUED'
  | 'PLANNING'
  | 'AWAITING_PLAN_APPROVAL'
  | 'AWAITING_USER_FEEDBACK'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'FAILED'
  | 'COMPLETED';


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
