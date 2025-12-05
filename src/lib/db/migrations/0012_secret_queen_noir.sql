CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`jules_api_key` text,
	`github_token` text,
	`created_at` text NOT NULL,
	`updated_at` text,
	`is_selected` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE `cron_jobs` ADD `profile_id` text REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `jobs` ADD `profile_id` text REFERENCES profiles(id);