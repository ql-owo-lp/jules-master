
import { describe, it, expect } from 'vitest';
import { settingsSchema, createSessionSchema } from '../src/lib/validation';

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

  describe('createSessionSchema', () => {
    it('should validate valid session data', () => {
      const validData = {
        prompt: 'test prompt',
        sourceContext: {
          source: 'test-source',
          githubRepoContext: {
            startingBranch: 'main'
          }
        }
      };
      const result = createSessionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should fail if prompt is missing', () => {
      const invalidData = {
        sourceContext: {
            source: 'test-source'
        }
      };
      const result = createSessionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should fail if sourceContext is missing', () => {
        const invalidData = {
            prompt: 'test prompt'
        };
        const result = createSessionSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
    });

    it('should strip extra fields', () => {
        const dataWithExtra = {
            prompt: 'test prompt',
            sourceContext: {
                source: 'test-source',
                githubRepoContext: {
                    startingBranch: 'main'
                }
            },
            extraField: 'should go away'
        };
        const result = createSessionSchema.safeParse(dataWithExtra);
        expect(result.success).toBe(true);
        if (result.success) {
            // @ts-expect-error - testing stripped field
            expect(result.data.extraField).toBeUndefined();
        }
    });
  });
});
