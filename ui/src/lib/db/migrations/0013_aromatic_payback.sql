ALTER TABLE `sessions` ADD `pr_url` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `is_pr_merged` integer DEFAULT false;--> statement-breakpoint
UPDATE `sessions` SET `pr_url` = json_extract(`outputs`, '$[0].pullRequest.url') WHERE `outputs` IS NOT NULL;--> statement-breakpoint
UPDATE `sessions` SET `is_pr_merged` = 1 WHERE json_extract(`outputs`, '$[0].pullRequest.status') = 'MERGED';
