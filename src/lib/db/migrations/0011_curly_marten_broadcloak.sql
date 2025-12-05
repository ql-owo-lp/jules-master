CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_repo_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`repo` text NOT NULL,
	`prompt` text NOT NULL,
	`profile_id` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_repo_prompts`("id", "repo", "prompt", "profile_id") SELECT lower(hex(randomblob(16))), "repo", "prompt", NULL FROM `repo_prompts`;--> statement-breakpoint
DROP TABLE `repo_prompts`;--> statement-breakpoint
ALTER TABLE `__new_repo_prompts` RENAME TO `repo_prompts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `cron_jobs` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `cron_jobs` ADD `profile_id` text REFERENCES profiles(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `global_prompt` ADD `profile_id` text REFERENCES profiles(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `history_prompts` ADD `profile_id` text REFERENCES profiles(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `jobs` ADD `profile_id` text REFERENCES profiles(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `predefined_prompts` ADD `profile_id` text REFERENCES profiles(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `quick_replies` ADD `profile_id` text REFERENCES profiles(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `sessions` ADD `profile_id` text REFERENCES profiles(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `settings` ADD `profile_id` text REFERENCES profiles(id) ON DELETE cascade;