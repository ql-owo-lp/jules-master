
import { z } from 'zod';

export const settingsSchema = z.object({
  idlePollInterval: z.number().min(5, "Idle poll interval must be at least 5 seconds"),
  activePollInterval: z.number().min(1, "Active poll interval must be at least 1 second"),
  titleTruncateLength: z.number().min(10, "Title truncate length must be at least 10"),
  lineClamp: z.number().min(1, "Line clamp must be at least 1"),
  sessionItemsPerPage: z.number().min(1, "Session items per page must be at least 1").max(100, "Session items per page cannot exceed 100"),
  jobsPerPage: z.number().min(1, "Jobs per page must be at least 1").max(100, "Jobs per page cannot exceed 100"),
  defaultSessionCount: z.number().min(1, "Default session count must be at least 1").max(100, "Default session count cannot exceed 100"),
  prStatusPollInterval: z.number().min(10, "PR status poll interval must be at least 10 seconds"),
  theme: z.enum(['light', 'dark', 'system'], { errorMap: () => ({ message: "Theme must be 'light', 'dark', or 'system'" }) }),
  autoApprovalInterval: z.number().min(1, "Auto approval interval must be at least 1 second"),
  autoRetryEnabled: z.boolean(),
  autoRetryMessage: z.string().max(1000, "Auto retry message cannot exceed 1000 characters"),
  autoContinueEnabled: z.boolean(),
  autoContinueMessage: z.string().max(1000, "Auto continue message cannot exceed 1000 characters"),
  sessionCacheInProgressInterval: z.number().min(1, "Session cache in-progress interval must be at least 1 second"),
  sessionCacheCompletedNoPrInterval: z.number().min(1, "Session cache completed (no PR) interval must be at least 1 second"),
  sessionCachePendingApprovalInterval: z.number().min(1, "Session cache pending approval interval must be at least 1 second"),
  sessionCacheMaxAgeDays: z.number().min(1, "Session cache max age must be at least 1 day"),
  autoDeleteStaleBranches: z.boolean(),
  autoDeleteStaleBranchesAfterDays: z.number().min(1, "Auto delete stale branches after days must be at least 1"),
  historyPromptsCount: z.number().min(0, {
    message: "History prompts count must be a non-negative number.",
  }),
  minSessionInteractionInterval: z.number().min(1, "Min session interaction interval must be at least 1 second"),
  retryTimeout: z.number().min(1, "Retry timeout must be at least 1 second"),
  autoDeleteStaleBranchesInterval: z.number().min(60, "Auto delete stale branches interval must be at least 60 seconds"),
});
