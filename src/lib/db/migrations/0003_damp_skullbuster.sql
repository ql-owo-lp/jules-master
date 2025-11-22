CREATE TABLE `history_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`last_used_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `history_prompts_count` integer DEFAULT 10 NOT NULL;