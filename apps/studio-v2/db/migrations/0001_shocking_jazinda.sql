CREATE TABLE `materials` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`idea_id` integer,
	`kind` text NOT NULL,
	`segment_code` text DEFAULT 'S3' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`hook` text,
	`body` text,
	`scenes` text,
	`visual` text,
	`cta` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `materials_idea_idx` ON `materials` (`idea_id`);--> statement-breakpoint
CREATE INDEX `materials_created_idx` ON `materials` (`created_at`);--> statement-breakpoint
CREATE INDEX `materials_deleted_idx` ON `materials` (`deleted_at`);