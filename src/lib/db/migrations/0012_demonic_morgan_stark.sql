CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE `settings` ADD `profile_id` text REFERENCES profiles(id);