CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`idle_poll_interval` integer DEFAULT 120 NOT NULL,
	`active_poll_interval` integer DEFAULT 30 NOT NULL,
	`title_truncate_length` integer DEFAULT 50 NOT NULL,
	`line_clamp` integer DEFAULT 1 NOT NULL,
	`session_items_per_page` integer DEFAULT 10 NOT NULL,
	`jobs_per_page` integer DEFAULT 5 NOT NULL,
	`default_session_count` integer DEFAULT 10 NOT NULL,
	`pr_status_poll_interval` integer DEFAULT 60 NOT NULL
);
