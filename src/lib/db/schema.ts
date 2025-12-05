import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { SourceContext, SessionOutput, AutomationMode } from '@/lib/types';

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
  profileId: text('profile_id'),
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
  profileId: text('profile_id'),
});

export const predefinedPrompts = sqliteTable('predefined_prompts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
});

export const historyPrompts = sqliteTable('history_prompts', {
  id: text('id').primaryKey(),
  prompt: text('prompt').notNull(),
  lastUsedAt: text('last_used_at').notNull(),
});

export const quickReplies = sqliteTable('quick_replies', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
});

export const globalPrompt = sqliteTable('global_prompt', {
  id: integer('id').primaryKey(),
  prompt: text('prompt').notNull(),
});

export const repoPrompts = sqliteTable('repo_prompts', {
  repo: text('repo').primaryKey(),
  prompt: text('prompt').notNull(),
});

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  settings: text('settings', { mode: 'json' }).notNull(),
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
});
