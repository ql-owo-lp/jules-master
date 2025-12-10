
import { z } from 'zod';

export const settingsSchema = z.object({
  idlePollInterval: z.number(),
  activePollInterval: z.number(),
  titleTruncateLength: z.number(),
  lineClamp: z.number(),
  sessionItemsPerPage: z.number(),
  jobsPerPage: z.number(),
  defaultSessionCount: z.number(),
  prStatusPollInterval: z.number(),
  theme: z.string(),
  autoApprovalInterval: z.number(),
  autoRetryEnabled: z.boolean(),
  autoRetryMessage: z.string(),
  autoContinueEnabled: z.boolean(),
  autoContinueMessage: z.string(),
  sessionCacheInProgressInterval: z.number(),
  sessionCacheCompletedNoPrInterval: z.number(),
  sessionCachePendingApprovalInterval: z.number(),
  sessionCacheMaxAgeDays: z.number(),
  autoDeleteStaleBranches: z.boolean(),
  autoDeleteStaleBranchesAfterDays: z.number(),
  historyPromptsCount: z.number().min(0, {
    message: "History prompts count must be a non-negative number.",
  }),
  minSessionInteractionInterval: z.number(),
  retryTimeout: z.number(),
  autoDeleteStaleBranchesInterval: z.number(),
});
