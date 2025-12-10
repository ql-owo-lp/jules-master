import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import type { SourceContext, SessionOutput, AutomationMode } from '@/lib/types';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
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
  profileId: text('profile_id'), // Foreign key to profiles
});

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
  profileId: text('profile_id'), // Foreign key to profiles
});

export const predefinedPrompts = sqliteTable('predefined_prompts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  profileId: text('profile_id'), // Foreign key to profiles
});

export const historyPrompts = sqliteTable('history_prompts', {
  id: text('id').primaryKey(),
  prompt: text('prompt').notNull(),
  lastUsedAt: text('last_used_at').notNull(),
  profileId: text('profile_id'), // Foreign key to profiles
});

export const quickReplies = sqliteTable('quick_replies', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
  profileId: text('profile_id'), // Foreign key to profiles
});

export const globalPrompt = sqliteTable('global_prompt', {
  id: integer('id').primaryKey(),
  prompt: text('prompt').notNull(),
  profileId: text('profile_id'), // Foreign key to profiles
});

export const repoPrompts = sqliteTable('repo_prompts', {
  repo: text('repo').notNull(),
  prompt: text('prompt').notNull(),
  profileId: text('profile_id').notNull().default('default'), // Foreign key to profiles
}, (table) => ({
  pk: primaryKey({ columns: [table.repo, table.profileId] }),
}));

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(), // We might want to keep this, or rely on profileId as PK if 1:1
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
  profileId: text('profile_id'), // Foreign key to profiles
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
  profileId: text('profile_id'), // Foreign key to profiles
});

export const locks = sqliteTable('locks', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
});
