CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_selected` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_name_unique` ON `profiles` (`name`);--> statement-breakpoint
ALTER TABLE `settings` ADD `profile_id` text REFERENCES profiles(id);
--> statement-breakpoint
INSERT INTO `profiles` (id, name, is_selected, created_at) VALUES ('default-profile', 'Default', true, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
--> statement-breakpoint
UPDATE `settings` SET `profile_id` = 'default-profile' WHERE `id` = 1;
