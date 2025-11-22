
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sessionIds: text('session_ids', { mode: 'json' }).$type<string[]>(),
  createdAt: text('created_at').notNull(),
  repo: text('repo').notNull(),
  branch: text('branch').notNull(),
});

export const predefinedPrompts = sqliteTable('predefined_prompts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  prompt: text('prompt').notNull(),
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
});
