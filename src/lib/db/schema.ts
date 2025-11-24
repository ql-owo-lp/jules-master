import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sessionIds: text('session_ids', { mode: 'json' }).$type<string[]>(),
  createdAt: text('created_at').notNull(),
  repo: text('repo').notNull(),
  branch: text('branch').notNull(),
  autoApproval: integer('auto_approval', { mode: 'boolean' }).notNull().default(false),
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
  autoApprovalInterval: integer('auto_approval_interval').notNull().default(60),
  autoRetry: integer('auto_retry', { mode: 'boolean' }).notNull().default(true),
  autoRetryInterval: integer('auto_retry_interval').notNull().default(60),
  autoRetryMessage: text('auto_retry_message').notNull().default("You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution"),
  autoContinue: integer('auto_continue', { mode: 'boolean' }).notNull().default(true),
  autoContinueInterval: integer('auto_continue_interval').notNull().default(60),
  autoContinueMessage: text('auto_continue_message').notNull().default("Sounds good. Now go ahead finish the work"),
});
