
import { describe, it, expect } from 'vitest';
import { settingsSchema } from '../src/lib/validation';

describe('Validation Schemas', () => {
  const minimalSettings = {
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
    autoRetryMessage: "msg",
    autoContinueEnabled: true,
    autoContinueMessage: "msg",
    sessionCacheInProgressInterval: 60,
    sessionCacheCompletedNoPrInterval: 1800,
    sessionCachePendingApprovalInterval: 300,
    sessionCacheMaxAgeDays: 3,
    autoDeleteStaleBranches: false,
    autoDeleteStaleBranchesAfterDays: 3,
    historyPromptsCount: 10,
    minSessionInteractionInterval: 60,
    retryTimeout: 1200,
    autoDeleteStaleBranchesInterval: 60,
  };

  describe('settingsSchema', () => {
    it('should validate valid profileId (UUID)', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const result = settingsSchema.safeParse({
        ...minimalSettings,
        profileId: validUUID
      });
      expect(result.success).toBe(true);
    });

    it('should validate valid profileId ("default")', () => {
      const result = settingsSchema.safeParse({
        ...minimalSettings,
        profileId: 'default'
      });
      expect(result.success).toBe(true);
    });

    it('should fail on invalid profileId', () => {
      const result = settingsSchema.safeParse({
        ...minimalSettings,
        profileId: 'invalid-id'
      });
      expect(result.success).toBe(false);
      if (!result.success) {
          expect(result.error.issues[0].path).toContain('profileId');
      }
    });
  });
});
