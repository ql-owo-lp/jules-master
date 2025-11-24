ALTER TABLE `settings` ADD `auto_retry_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `auto_retry_message` text DEFAULT 'You have been doing a great job. Let’s try another approach to see if we can achieve the same goal. Do not stop until you find a solution' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `auto_continue_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `auto_continue_message` text DEFAULT 'Sounds good. Now go ahead finish the work' NOT NULL;