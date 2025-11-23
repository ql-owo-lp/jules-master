ALTER TABLE `jobs` ADD `auto_approval` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `auto_approval_interval` integer DEFAULT 60 NOT NULL;