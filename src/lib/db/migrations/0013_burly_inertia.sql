CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `profiles` (`id`, `name`, `is_active`, `created_at`) VALUES ('default', 'Default', 1, datetime('now'));
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_repo_prompts` (
	`repo` text NOT NULL,
	`prompt` text NOT NULL,
	`profile_id` text DEFAULT 'default' NOT NULL,
	PRIMARY KEY(`repo`, `profile_id`)
);
--> statement-breakpoint
INSERT INTO `__new_repo_prompts`("repo", "prompt", "profile_id") SELECT "repo", "prompt", 'default' FROM `repo_prompts`;--> statement-breakpoint
DROP TABLE `repo_prompts`;--> statement-breakpoint
ALTER TABLE `__new_repo_prompts` RENAME TO `repo_prompts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `cron_jobs` ADD `profile_id` text;--> statement-breakpoint
UPDATE `cron_jobs` SET `profile_id` = 'default';--> statement-breakpoint
ALTER TABLE `global_prompt` ADD `profile_id` text;--> statement-breakpoint
UPDATE `global_prompt` SET `profile_id` = 'default';--> statement-breakpoint
ALTER TABLE `history_prompts` ADD `profile_id` text;--> statement-breakpoint
UPDATE `history_prompts` SET `profile_id` = 'default';--> statement-breakpoint
ALTER TABLE `jobs` ADD `profile_id` text;--> statement-breakpoint
UPDATE `jobs` SET `profile_id` = 'default';--> statement-breakpoint
ALTER TABLE `predefined_prompts` ADD `profile_id` text;--> statement-breakpoint
UPDATE `predefined_prompts` SET `profile_id` = 'default';--> statement-breakpoint
ALTER TABLE `quick_replies` ADD `profile_id` text;--> statement-breakpoint
UPDATE `quick_replies` SET `profile_id` = 'default';--> statement-breakpoint
ALTER TABLE `sessions` ADD `profile_id` text;--> statement-breakpoint
UPDATE `sessions` SET `profile_id` = 'default';--> statement-breakpoint
ALTER TABLE `settings` ADD `profile_id` text;--> statement-breakpoint
UPDATE `settings` SET `profile_id` = 'default';
