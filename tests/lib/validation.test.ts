
import { settingsSchema } from '@/lib/validation';
import { describe, it, expect } from 'vitest';

describe('settingsSchema', () => {
  it('should invalidate negative historyPromptsCount', () => {
    const invalidSettings = {
      historyPromptsCount: -1,
      // Add other required fields with valid values
      idlePollInterval: 120,
      activePollInterval: 30,
      titleTruncateLength: 50,
      lineClamp: 1,
      sessionItemsPerPage: 10,
      jobsPerPage: 5,
      defaultSessionCount: 10,
      prStatusPollInterval: 60,
      theme: 'system',
      autoApprovalInterval: 60,
      autoRetryEnabled: true,
      autoRetryMessage: "Retry",
      autoContinueEnabled: true,
      autoContinueMessage: "Continue",
      sessionCacheInProgressInterval: 60,
      sessionCacheCompletedNoPrInterval: 1800,
      sessionCachePendingApprovalInterval: 300,
      sessionCacheMaxAgeDays: 3,
      autoDeleteStaleBranches: false,
      autoDeleteStaleBranchesAfterDays: 3,
    };
    const result = settingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });
});
