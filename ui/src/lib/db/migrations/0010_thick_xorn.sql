ALTER TABLE `settings` ADD `auto_merge_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `auto_merge_method` text DEFAULT 'squash' NOT NULL;