import { integer, sqliteTable, text, primaryKey, index } from 'drizzle-orm/sqlite-core';
import type { SourceContext, SessionOutput, AutomationMode } from '@/lib/types';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
});

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sessionIds: text('session_ids', { mode: 'json' }).$type<string[]>(),
  createdAt: text('created_at').notNull(),
  repo: text('repo').notNull(),
  branch: text('branch').notNull(),
  autoApproval: integer('auto_approval', { mode: 'boolean' }).notNull().default(false),
  background: integer('background', { mode: 'boolean' }).notNull().default(false),
  prompt: text('prompt'),
  sessionCount: integer('session_count'),
  status: text('status'), // 'PENDING', 'PROCESSING', 'COMPLETED'
  automationMode: text('automation_mode').$type<AutomationMode>(),
  requirePlanApproval: integer('require_plan_approval', { mode: 'boolean' }),
  cronJobId: text('cron_job_id'),
  profileId: text('profile_id').references(() => profiles.id).notNull().default('default'),
}, (table) => ({
  // Optimization: Add composite index on profileId and createdAt to speed up job listing queries.
  // This helps when filtering jobs by profile and sorting by creation time.
  profileIdCreatedAtIdx: index('jobs_profile_id_created_at_idx').on(table.profileId, table.createdAt),
}));

export const cronJobs = sqliteTable('cron_jobs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  schedule: text('schedule').notNull(),
  prompt: text('prompt').notNull(),
  repo: text('repo').notNull(),
  branch: text('branch').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
  lastRunAt: text('last_run_at'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  autoApproval: integer('auto_approval', { mode: 'boolean' }).notNull().default(false),
  automationMode: text('automation_mode').$type<AutomationMode>(),
  requirePlanApproval: integer('require_plan_approval', { mode: 'boolean' }),
  sessionCount: integer('session_count').default(1),
  profileId: text('profile_id').references(() => profiles.id).notNull().default('default'),
}, (table) => ({
  // Optimization: Add composite index on profileId and createdAt for cron jobs listing.
  profileIdCreatedAtIdx: index('cron_jobs_profile_id_created_at_idx').on(table.profileId, table.createdAt),
}));

export const predefinedPrompts = sqliteTable('predefined_prompts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  profileId: text('profile_id').references(() => profiles.id).notNull().default('default'),
});

export const historyPrompts = sqliteTable('history_prompts', {
  id: text('id').primaryKey(),
  prompt: text('prompt').notNull(),
  lastUsedAt: text('last_used_at').notNull(),
  profileId: text('profile_id').references(() => profiles.id).notNull().default('default'),
});

export const quickReplies = sqliteTable('quick_replies', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  profileId: text('profile_id').references(() => profiles.id).notNull().default('default'),
});

export const globalPrompt = sqliteTable('global_prompt', {
  id: integer('id').primaryKey(),
  prompt: text('prompt').notNull(),
  profileId: text('profile_id').references(() => profiles.id).notNull().default('default'),
});

export const repoPrompts = sqliteTable('repo_prompts', {
  repo: text('repo').notNull(),
  prompt: text('prompt').notNull(),
  profileId: text('profile_id').references(() => profiles.id).notNull().default('default'),
}, (table) => ({
  pk: primaryKey({ columns: [table.repo, table.profileId] }),
}));

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  idlePollInterval: integer('idle_poll_interval').notNull().default(120),
  activePollInterval: integer('active_poll_interval').notNull().default(30),
  titleTruncateLength: integer('title_truncate_length').notNull().default(50),
  lineClamp: integer('line_clamp').notNull().default(1),
  sessionItemsPerPage: integer('session_items_per_page').notNull().default(10),
  jobsPerPage: integer('jobs_per_page').notNull().default(5),
  defaultSessionCount: integer('default_session_count').notNull().default(10),
  prStatusPollInterval: integer('pr_status_poll_interval').notNull().default(60),
  theme: text('theme').notNull().default('system'),
  historyPromptsCount: integer('history_prompts_count').notNull().default(10),
  autoApprovalEnabled: integer('auto_approval_enabled', { mode: 'boolean' }).notNull().default(false),
  autoApprovalInterval: integer('auto_approval_interval').notNull().default(60),
  autoRetryEnabled: integer('auto_retry_enabled', { mode: 'boolean' }).notNull().default(true),
  autoRetryMessage: text('auto_retry_message').notNull().default("You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution"),
  autoContinueEnabled: integer('auto_continue_enabled', { mode: 'boolean' }).notNull().default(true),
  autoContinueMessage: text('auto_continue_message').notNull().default("Sounds good. Now go ahead finish the work"),
  // Session Cache Settings
  sessionCacheInProgressInterval: integer('session_cache_in_progress_interval').notNull().default(60),
  sessionCacheCompletedNoPrInterval: integer('session_cache_completed_no_pr_interval').notNull().default(1800), // 30 minutes
  sessionCachePendingApprovalInterval: integer('session_cache_pending_approval_interval').notNull().default(300), // 5 minutes
  sessionCacheMaxAgeDays: integer('session_cache_max_age_days').notNull().default(3),
  autoDeleteStaleBranches: integer('auto_delete_stale_branches', { mode: 'boolean' }).notNull().default(false),
  autoDeleteStaleBranchesAfterDays: integer('auto_delete_stale_branches_after_days').notNull().default(3),
  autoDeleteStaleBranchesInterval: integer('auto_delete_stale_branches_interval').notNull().default(1800), // 30 minutes
  // Check Failing Actions
  checkFailingActionsEnabled: integer('check_failing_actions_enabled', { mode: 'boolean' }).notNull().default(true),
  checkFailingActionsInterval: integer('check_failing_actions_interval').notNull().default(600), // 10 minutes default
  checkFailingActionsThreshold: integer('check_failing_actions_threshold').notNull().default(10),
  // Auto-Close Conflicted PRs
  closePrOnConflictEnabled: integer('close_pr_on_conflict_enabled', { mode: 'boolean' }).notNull().default(false),
  // Auto-Close Stale PRs
  autoCloseStaleConflictedPrs: integer('auto_close_stale_conflicted_prs', { mode: 'boolean' }).notNull().default(false),
  staleConflictedPrsDurationDays: integer('stale_conflicted_prs_duration_days').notNull().default(3),
  // Throttling Settings
  minSessionInteractionInterval: integer('min_session_interaction_interval').notNull().default(60),
  retryTimeout: integer('retry_timeout').notNull().default(1200), // 20 minutes
  maxConcurrentBackgroundWorkers: integer('max_concurrent_background_workers').notNull().default(5),
  autoApprovalAllSessions: integer('auto_approval_all_sessions', { mode: 'boolean' }).notNull().default(true),
  autoContinueAllSessions: integer('auto_continue_all_sessions', { mode: 'boolean' }).notNull().default(true),
  autoMergeEnabled: integer('auto_merge_enabled', { mode: 'boolean' }).notNull().default(false),
  autoMergeMethod: text('auto_merge_method').notNull().default('squash'),
  autoMergeMessage: text('auto_merge_message').notNull().default('Automatically merged by bot as all checks passed'),
  autoCloseOnConflictMessage: text('auto_close_on_conflict_message').notNull().default('Closed due to merge conflict'),
  profileId: text('profile_id').references(() => profiles.id).notNull().default('default'),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  sourceContext: text('source_context', { mode: 'json' }).$type<SourceContext>(),
  createTime: text('create_time'),
  updateTime: text('update_time'),
  state: text('state').notNull(),
  url: text('url'),
  outputs: text('outputs', { mode: 'json' }).$type<SessionOutput[]>(),
  requirePlanApproval: integer('require_plan_approval', { mode: 'boolean' }),
  automationMode: text('automation_mode').$type<AutomationMode>(),
  lastUpdated: integer('last_updated').notNull(), // Timestamp in ms
  retryCount: integer('retry_count').notNull().default(0),
  lastError: text('last_error'),
  lastInteractionAt: integer('last_interaction_at'),
  profileId: text('profile_id').references(() => profiles.id).notNull().default('default'),
}, (table) => ({
  // Optimization: Add composite index on profileId and createTime to speed up session listing queries.
  // This helps when filtering sessions by profile and sorting by creation time, which is a very common operation.
  profileIdCreateTimeIdx: index('sessions_profile_id_create_time_idx').on(table.profileId, table.createTime),
}));

export const locks = sqliteTable('locks', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
});
