PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`idle_poll_interval` integer DEFAULT 120 NOT NULL,
	`active_poll_interval` integer DEFAULT 30 NOT NULL,
	`title_truncate_length` integer DEFAULT 50 NOT NULL,
	`line_clamp` integer DEFAULT 1 NOT NULL,
	`session_items_per_page` integer DEFAULT 10 NOT NULL,
	`jobs_per_page` integer DEFAULT 5 NOT NULL,
	`default_session_count` integer DEFAULT 10 NOT NULL,
	`pr_status_poll_interval` integer DEFAULT 60 NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`history_prompts_count` integer DEFAULT 10 NOT NULL,
	`auto_approval_enabled` integer DEFAULT false NOT NULL,
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
	`auto_delete_stale_branches_after_days` integer DEFAULT 3 NOT NULL,
	`auto_delete_stale_branches_interval` integer DEFAULT 1800 NOT NULL,
	`check_failing_actions_enabled` integer DEFAULT true NOT NULL,
	`check_failing_actions_interval` integer DEFAULT 600 NOT NULL,
	`check_failing_actions_threshold` integer DEFAULT 10 NOT NULL,
	`min_session_interaction_interval` integer DEFAULT 60 NOT NULL,
	`retry_timeout` integer DEFAULT 1200 NOT NULL,
	`profile_id` text DEFAULT 'default' NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "idle_poll_interval", "active_poll_interval", "title_truncate_length", "line_clamp", "session_items_per_page", "jobs_per_page", "default_session_count", "pr_status_poll_interval", "theme", "history_prompts_count", "auto_approval_enabled", "auto_approval_interval", "auto_retry_enabled", "auto_retry_message", "auto_continue_enabled", "auto_continue_message", "session_cache_in_progress_interval", "session_cache_completed_no_pr_interval", "session_cache_pending_approval_interval", "session_cache_max_age_days", "auto_delete_stale_branches", "auto_delete_stale_branches_after_days", "auto_delete_stale_branches_interval", "check_failing_actions_enabled", "check_failing_actions_interval", "check_failing_actions_threshold", "min_session_interaction_interval", "retry_timeout", "profile_id") SELECT "id", "idle_poll_interval", "active_poll_interval", "title_truncate_length", "line_clamp", "session_items_per_page", "jobs_per_page", "default_session_count", "pr_status_poll_interval", "theme", "history_prompts_count", "auto_approval_enabled", "auto_approval_interval", "auto_retry_enabled", "auto_retry_message", "auto_continue_enabled", "auto_continue_message", "session_cache_in_progress_interval", "session_cache_completed_no_pr_interval", "session_cache_pending_approval_interval", "session_cache_max_age_days", "auto_delete_stale_branches", "auto_delete_stale_branches_after_days", "auto_delete_stale_branches_interval", "check_failing_actions_enabled", "check_failing_actions_interval", 10, "min_session_interaction_interval", "retry_timeout", "profile_id" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;