
import { describe, it, expect } from 'vitest';
import { settingsSchema } from '../src/lib/validation';

describe('settingsSchema Validation', () => {
  it('should allow valid settings', () => {
    const validSettings = {
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
      autoRetryMessage: "Keep going",
      autoContinueEnabled: true,
      autoContinueMessage: "Continue",
      sessionCacheInProgressInterval: 60,
      sessionCacheCompletedNoPrInterval: 1800,
      sessionCachePendingApprovalInterval: 300,
      sessionCacheMaxAgeDays: 3,
      autoDeleteStaleBranches: false,
      autoDeleteStaleBranchesAfterDays: 3,
      historyPromptsCount: 10,
      minSessionInteractionInterval: 60,
      retryTimeout: 1200,
      // autoDeleteStaleBranchesInterval is optional now
    };
    const result = settingsSchema.safeParse(validSettings);
    if (!result.success) {
        console.error(result.error);
    }
    expect(result.success).toBe(true);
  });

  it('should allow valid settings with autoDeleteStaleBranchesInterval', () => {
      const validSettings = {
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
        autoRetryMessage: "Keep going",
        autoContinueEnabled: true,
        autoContinueMessage: "Continue",
        sessionCacheInProgressInterval: 60,
        sessionCacheCompletedNoPrInterval: 1800,
        sessionCachePendingApprovalInterval: 300,
        sessionCacheMaxAgeDays: 3,
        autoDeleteStaleBranches: false,
        autoDeleteStaleBranchesAfterDays: 3,
        historyPromptsCount: 10,
        minSessionInteractionInterval: 60,
        retryTimeout: 1200,
        autoDeleteStaleBranchesInterval: 1800,
      };
      const result = settingsSchema.safeParse(validSettings);
      expect(result.success).toBe(true);
  });

  it('should fail on invalid types', () => {
    const invalidSettings = {
      idlePollInterval: "not a number",
    };
    const result = settingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });

  it('should reject negative numbers', () => {
    const negativeSettings = {
      idlePollInterval: -100,
      activePollInterval: -10,
      titleTruncateLength: -50,
      lineClamp: -1,
      sessionItemsPerPage: -10,
      jobsPerPage: -5,
      defaultSessionCount: -10,
      prStatusPollInterval: -60,
      theme: 'system',
      autoApprovalInterval: -60,
      autoRetryEnabled: true,
      autoRetryMessage: "Keep going",
      autoContinueEnabled: true,
      autoContinueMessage: "Continue",
      sessionCacheInProgressInterval: -60,
      sessionCacheCompletedNoPrInterval: -1800,
      sessionCachePendingApprovalInterval: -300,
      sessionCacheMaxAgeDays: -3,
      autoDeleteStaleBranches: false,
      autoDeleteStaleBranchesAfterDays: -3,
      historyPromptsCount: -10,
      minSessionInteractionInterval: -60,
      retryTimeout: -1200,
      autoDeleteStaleBranchesInterval: -1800,
    };
    const result = settingsSchema.safeParse(negativeSettings);
    expect(result.success).toBe(false);
  });

  it('should reject invalid theme', () => {
     const invalidTheme = {
      idlePollInterval: 120,
      activePollInterval: 30,
      titleTruncateLength: 50,
      lineClamp: 1,
      sessionItemsPerPage: 10,
      jobsPerPage: 5,
      defaultSessionCount: 10,
      prStatusPollInterval: 60,
      theme: 'hacker-green', // Invalid theme
      autoApprovalInterval: 60,
      autoRetryEnabled: true,
      autoRetryMessage: "Keep going",
      autoContinueEnabled: true,
      autoContinueMessage: "Continue",
      sessionCacheInProgressInterval: 60,
      sessionCacheCompletedNoPrInterval: 1800,
      sessionCachePendingApprovalInterval: 300,
      sessionCacheMaxAgeDays: 3,
      autoDeleteStaleBranches: false,
      autoDeleteStaleBranchesAfterDays: 3,
      historyPromptsCount: 10,
      minSessionInteractionInterval: 60,
      retryTimeout: 1200,
      autoDeleteStaleBranchesInterval: 1800,
    };
    const result = settingsSchema.safeParse(invalidTheme);
    expect(result.success).toBe(false);
  });

  it('should reject overly long messages', () => {
    const longMessage = "a".repeat(1001);
    const invalidSettings = {
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
        autoRetryMessage: longMessage,
        autoContinueEnabled: true,
        autoContinueMessage: "Continue",
        sessionCacheInProgressInterval: 60,
        sessionCacheCompletedNoPrInterval: 1800,
        sessionCachePendingApprovalInterval: 300,
        sessionCacheMaxAgeDays: 3,
        autoDeleteStaleBranches: false,
        autoDeleteStaleBranchesAfterDays: 3,
        historyPromptsCount: 10,
        minSessionInteractionInterval: 60,
        retryTimeout: 1200,
        autoDeleteStaleBranchesInterval: 1800,
      };
      const result = settingsSchema.safeParse(invalidSettings);
      expect(result.success).toBe(false);
  });
});
