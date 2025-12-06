CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`jules_api_key` text,
	`github_token` text,
	`is_active` integer DEFAULT false NOT NULL,
	`idle_poll_interval` integer DEFAULT 120 NOT NULL,
	`active_poll_interval` integer DEFAULT 30 NOT NULL,
	`title_truncate_length` integer DEFAULT 50 NOT NULL,
	`line_clamp` integer DEFAULT 1 NOT NULL,
	`session_items_per_page` integer DEFAULT 10 NOT NULL,
	`jobs_per_page` integer DEFAULT 5 NOT NULL,
	`default_session_count` integer DEFAULT 10 NOT NULL,
	`pr_status_poll_interval` integer DEFAULT 60 NOT NULL,
	`history_prompts_count` integer DEFAULT 10 NOT NULL,
	`auto_approval_interval` integer DEFAULT 60 NOT NULL,
	`auto_retry_enabled` integer DEFAULT true NOT NULL,
	`auto_retry_message` text DEFAULT 'You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution' NOT NULL,
	`auto_continue_enabled` integer DEFAULT true NOT NULL,
	`auto_continue_message` text DEFAULT 'Sounds good. Now go ahead finish the work' NOT NULL,
	`session_cache_in_progress_interval` integer DEFAULT 60 NOT NULL,
	`session_cache_completed_no_pr_interval` integer DEFAULT 1800 NOT NULL,
	`session_cache_pending_approval_interval` integer DEFAULT 300 NOT NULL,
	`session_cache_max_age_days` integer DEFAULT 3 NOT NULL,
	`auto_delete_stale_branches` integer DEFAULT false NOT NULL,
	`auto_delete_stale_branches_after_days` integer DEFAULT 3 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `idle_poll_interval`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `active_poll_interval`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `title_truncate_length`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `line_clamp`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `session_items_per_page`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `jobs_per_page`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `default_session_count`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `pr_status_poll_interval`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `history_prompts_count`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `auto_approval_interval`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `auto_retry_enabled`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `auto_retry_message`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `auto_continue_enabled`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `auto_continue_message`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `session_cache_in_progress_interval`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `session_cache_completed_no_pr_interval`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `session_cache_pending_approval_interval`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `session_cache_max_age_days`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `auto_delete_stale_branches`;--> statement-breakpoint
ALTER TABLE `settings` DROP COLUMN `auto_delete_stale_branches_after_days`;