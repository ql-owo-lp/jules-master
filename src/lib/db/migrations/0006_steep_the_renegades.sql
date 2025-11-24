CREATE TABLE `processed_sessions` (
	`session_id` text NOT NULL,
	`automation_type` text NOT NULL,
	PRIMARY KEY(`session_id`, `automation_type`)
);
