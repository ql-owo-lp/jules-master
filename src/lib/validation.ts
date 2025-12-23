
import { z } from 'zod';

export const settingsSchema = z.object({
  idlePollInterval: z.number().min(10, "Idle poll interval must be at least 10 seconds"),
  activePollInterval: z.number().min(5, "Active poll interval must be at least 5 seconds"),
  titleTruncateLength: z.number().min(10).max(500),
  lineClamp: z.number().min(1).max(10),
  sessionItemsPerPage: z.number().min(1).max(100),
  jobsPerPage: z.number().min(1).max(50),
  defaultSessionCount: z.number().min(1).max(50),
  prStatusPollInterval: z.number().min(10),
  theme: z.enum(['system', 'light', 'dark']),
  autoApprovalInterval: z.number().min(10),
  autoRetryEnabled: z.boolean(),
  autoRetryMessage: z.string().max(2000, "Auto retry message is too long"),
  autoContinueEnabled: z.boolean(),
  autoContinueMessage: z.string().max(2000, "Auto continue message is too long"),
  sessionCacheInProgressInterval: z.number().min(10),
  sessionCacheCompletedNoPrInterval: z.number().min(10),
  sessionCachePendingApprovalInterval: z.number().min(10),
  sessionCacheMaxAgeDays: z.number().min(1).max(365),
  autoDeleteStaleBranches: z.boolean(),
  autoDeleteStaleBranchesAfterDays: z.number().min(1).max(365),
  historyPromptsCount: z.number().min(0, {
    message: "History prompts count must be a non-negative number.",
  }).max(100),
  minSessionInteractionInterval: z.number().min(1),
  retryTimeout: z.number().min(60),
  autoDeleteStaleBranchesInterval: z.number().min(60),
});
