
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
