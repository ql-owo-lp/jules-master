CREATE TABLE `cron_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text,
	`name` text NOT NULL,
	`schedule` text NOT NULL,
	`prompt` text NOT NULL,
	`repo` text NOT NULL,
	`branch` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	`last_run_at` text,
	`enabled` integer DEFAULT true NOT NULL,
	`auto_approval` integer DEFAULT false NOT NULL,
	`automation_mode` text,
	`require_plan_approval` integer,
	`session_count` integer DEFAULT 1,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `global_prompt` (
	`id` integer PRIMARY KEY NOT NULL,
	`profile_id` text,
	`prompt` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `history_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text,
	`prompt` text NOT NULL,
	`last_used_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text,
	`name` text NOT NULL,
	`session_ids` text,
	`created_at` text NOT NULL,
	`repo` text NOT NULL,
	`branch` text NOT NULL,
	`auto_approval` integer DEFAULT false NOT NULL,
	`background` integer DEFAULT false NOT NULL,
	`prompt` text,
	`session_count` integer,
	`status` text,
	`automation_mode` text,
	`require_plan_approval` integer,
	`cron_job_id` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `locks` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `predefined_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	`github_token` text,
	`jules_api_url` text,
	`jules_api_key` text
);
--> statement-breakpoint
CREATE TABLE `quick_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `repo_prompts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` text,
	`repo` text NOT NULL,
	`prompt` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`source_context` text,
	`create_time` text,
	`update_time` text,
	`state` text NOT NULL,
	`url` text,
	`outputs` text,
	`require_plan_approval` integer,
	`automation_mode` text,
	`last_updated` integer NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` text,
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
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
