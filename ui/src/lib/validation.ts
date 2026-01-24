
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
  theme: z.string().max(20),
  autoApprovalInterval: z.number(),
  autoApprovalEnabled: z.boolean().optional().default(false),
  autoRetryEnabled: z.boolean(),
  autoRetryMessage: z.string().max(1000),
  autoContinueEnabled: z.boolean(),
  autoContinueMessage: z.string().max(1000),
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
  // autoDeleteStaleBranchesInterval: z.number(), // Removed
  checkFailingActionsEnabled: z.boolean().optional().default(true),
  checkFailingActionsInterval: z.number().optional().default(600),
  checkFailingActionsThreshold: z.number().optional().default(10),
  autoCloseStaleConflictedPrs: z.boolean().optional().default(false),
  staleConflictedPrsDurationDays: z.number().optional().default(3),
  closePrOnConflictEnabled: z.boolean().optional().default(false),
  profileId: z.union([z.string().uuid(), z.literal('default')]).optional(),
});

export const cronJobSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  schedule: z.string().min(1, "Schedule is required").max(100),
  prompt: z.string().min(1, "Prompt is required").max(50000),
  repo: z.string().min(1, "Repository is required").max(200),
  branch: z.string().min(1, "Branch is required").max(250),
  autoApproval: z.boolean(),
  automationMode: z.enum(['AUTOMATION_MODE_UNSPECIFIED', 'AUTO_CREATE_PR']).optional(),
  requirePlanApproval: z.boolean().optional(),
  sessionCount: z.number().int().min(1).optional(),
  profileId: z.union([z.string().uuid(), z.literal('default')]).optional(),
});

export const createSessionSchema = z.object({
  title: z.string().max(100).optional(),
  prompt: z.string().min(1, "Prompt is required").max(50000),
  sourceContext: z.object({
    source: z.string().min(1, "Source is required").max(500),
    githubRepoContext: z.object({
        startingBranch: z.string().min(1, "Starting branch is required").max(250),
        branch: z.string().max(250).optional()
    }).optional()
  }),
  requirePlanApproval: z.boolean().optional(),
  automationMode: z.enum(['AUTOMATION_MODE_UNSPECIFIED', 'AUTO_CREATE_PR']).optional(),
  autoContinueEnabled: z.boolean().optional(),
  autoRetryEnabled: z.boolean().optional(),
});
