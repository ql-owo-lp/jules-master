--> statement-breakpoint
CREATE TABLE `global_prompt` (
	`id` integer PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`session_ids` text,
	`created_at` text NOT NULL,
	`repo` text NOT NULL,
	`branch` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `predefined_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quick_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL
);
