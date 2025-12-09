
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
  state: State;
  url?: string;
  outputs?: SessionOutput[];
  requirePlanApproval?: boolean;
  automationMode?: AutomationMode;
  retryCount?: number;
  lastError?: string;
};

export type Job = {
    id: string;
    name: string;
    sessionIds: string[];
    createdAt: string;
    repo: string;
    sourceName?: string | null;
    branch: string;
    autoApproval?: boolean;
    background?: boolean;
    prompt?: string;
    sessionCount?: number;
    status?: string;
    automationMode?: AutomationMode;
    requirePlanApproval?: boolean;
    cronJobId?: string | null;
}

export type CronJob = {
    id: string;
    name: string;
    schedule: string;
    prompt: string;
    repo: string;
    sourceName?: string | null;
    branch: string;
    createdAt: string;
    lastRunAt: string | null;
    enabled: boolean;
    autoApproval: boolean;
    automationMode?: AutomationMode;
    requirePlanApproval?: boolean;
    sessionCount?: number;
};

export type SourceContext = {
  source: string;
  githubRepoContext?: GitHubRepoContext;
};

export type GitHubRepoContext = {
  startingBranch: string;
  branch?: string;
};

export type SessionOutput = {
  pullRequest?: PullRequest;
};

export type PullRequest = {
  url:string;
  title: string;
  description: string;
  status?: 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT' | 'UNKNOWN';
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

export type HistoryPrompt = {
    id: string;
    prompt: string;
    lastUsedAt: string;
};

// Activity and related types
export interface Activity {
  name: string;
  id: string;
  description: string;
  createTime: string;
  originator: string;
  artifacts?: Artifact[];
  agentMessaged?: AgentMessaged;
  userMessaged?: UserMessaged;
  planGenerated?: PlanGenerated;
  planApproved?: PlanApproved;
  progressUpdated?: ProgressUpdated;
  sessionCompleted?: SessionCompleted;
  sessionFailed?: SessionFailed;
}

export interface AgentMessaged {
  agentMessage: string;
}

export interface UserMessaged {
  userMessage: string;
}

export interface PlanGenerated {
  plan: Plan;
}

export interface Plan {
  id: string;
  steps: PlanStep[];
  createTime: string;
}

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  index: number;
}

export interface PlanApproved {
  planId: string;
}

export interface ProgressUpdated {
  title: string;
  description: string;
}

export interface SessionCompleted {}

export interface SessionFailed {
  reason: string;
}

export interface Artifact {
  changeSet?: ChangeSet;
  media?: Media;
  bashOutput?: BashOutput;
}

export interface ChangeSet {
  source: string;
  gitPatch?: GitPatch;
}

export interface GitPatch {
  unidiffPatch: string;
  baseCommitId: string;
  suggestedCommitMessage: string;
}

export interface Media {
  data: string; // base64 encoded
  mimeType: string;
}

export interface BashOutput {
  command: string;
  output: string;
  exitCode: number;
}


// From GitHub API
export type GitHubPullRequest = {
  url: string;
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  merged: boolean;
  merged_at: string | null;
  head: {
    sha: string;
  };
};

export type CheckRun = {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
};

export type PullRequestStatus = {
  state: 'OPEN' | 'MERGED' | 'CLOSED' | 'NO_TOKEN' | 'ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED';
  merged_at?: string | null;
  checks: {
    status: 'pending' | 'success' | 'failure' | 'unknown';
    total: number;
    passed: number;
    runs: Pick<CheckRun, 'name' | 'status' | 'conclusion'>[];
  }
};

export type Settings = {
  autoContinueEnabled?: boolean;
  autoRetryEnabled?: boolean;
};
