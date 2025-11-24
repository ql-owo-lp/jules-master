CREATE TABLE `session_cache` (
	`session_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`last_updated` integer NOT NULL,
	`state` text NOT NULL,
	`pr_merged` integer DEFAULT false,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `session_cache_days` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `session_in_progress_interval` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `session_completed_interval` integer DEFAULT 1800 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `session_pending_interval` integer DEFAULT 300 NOT NULL;