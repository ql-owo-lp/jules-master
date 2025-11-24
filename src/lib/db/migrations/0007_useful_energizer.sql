CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`source_context` text NOT NULL,
	`create_time` text NOT NULL,
	`update_time` text,
	`state` text NOT NULL,
	`url` text,
	`outputs` text,
	`require_plan_approval` integer,
	`automation_mode` text,
	`last_updated` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `session_cache_in_progress_interval` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `session_cache_completed_no_pr_interval` integer DEFAULT 1800 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `session_cache_pending_approval_interval` integer DEFAULT 300 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `session_cache_max_age_days` integer DEFAULT 3 NOT NULL;