CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`github_token` text,
	`jules_api_key` text,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `cron_jobs` ADD `profile_id` text REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `global_prompt` ADD `profile_id` text REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `history_prompts` ADD `profile_id` text REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `jobs` ADD `profile_id` text REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `predefined_prompts` ADD `profile_id` text REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `quick_replies` ADD `profile_id` text REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `repo_prompts` ADD `profile_id` text REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `sessions` ADD `profile_id` text REFERENCES profiles(id);--> statement-breakpoint
ALTER TABLE `settings` ADD `profile_id` text REFERENCES profiles(id);