CREATE TABLE `cron_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`schedule` text NOT NULL,
	`prompt` text NOT NULL,
	`repo` text NOT NULL,
	`branch` text NOT NULL,
	`created_at` text NOT NULL,
	`last_run_at` text,
	`enabled` integer DEFAULT true NOT NULL,
	`auto_approval` integer DEFAULT false NOT NULL,
	`automation_mode` text,
	`require_plan_approval` integer,
	`session_count` integer DEFAULT 1
);
--> statement-breakpoint
ALTER TABLE `jobs` ADD `cron_job_id` text;