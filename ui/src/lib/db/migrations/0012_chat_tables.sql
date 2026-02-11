CREATE TABLE `chat_configs` (
	`job_id` text PRIMARY KEY NOT NULL,
	`api_key` text NOT NULL,
	`agent_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`sender_name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`is_human` integer DEFAULT false
);
