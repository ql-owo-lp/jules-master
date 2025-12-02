ALTER TABLE `jobs` ADD `background` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `prompt` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `session_count` integer;--> statement-breakpoint
ALTER TABLE `jobs` ADD `status` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `automation_mode` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `require_plan_approval` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `retry_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_error` text;