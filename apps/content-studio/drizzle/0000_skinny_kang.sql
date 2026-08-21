CREATE TABLE `audience_segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`code` varchar(8) NOT NULL,
	`sortOrder` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`title` varchar(180) NOT NULL,
	`subtitle` text NOT NULL,
	`goal` text NOT NULL,
	`pain` text NOT NULL,
	`fear` text NOT NULL,
	`trigger` text NOT NULL,
	`offer` text NOT NULL,
	`color` varchar(16) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audience_segments_id` PRIMARY KEY(`id`),
	CONSTRAINT `audience_segments_owner_code_unique` UNIQUE(`ownerId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `content_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`color` varchar(16) NOT NULL DEFAULT '#D84444',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`folderId` int,
	`kind` enum('idea','post','reel') NOT NULL DEFAULT 'idea',
	`channel` enum('telegram','reels','both') NOT NULL DEFAULT 'telegram',
	`status` enum('draft','planned','ready','published') NOT NULL DEFAULT 'draft',
	`priority` enum('low','medium','high','viral') NOT NULL DEFAULT 'medium',
	`segmentId` varchar(8) NOT NULL DEFAULT 'S3',
	`title` varchar(280) NOT NULL,
	`hook` text,
	`body` text,
	`format` varchar(100),
	`visual` text,
	`cta` text,
	`notes` text,
	`scheduledFor` timestamp,
	`isFavorite` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`itemId` int NOT NULL,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	`views` int NOT NULL DEFAULT 0,
	`reactions` int NOT NULL DEFAULT 0,
	`comments` int NOT NULL DEFAULT 0,
	`saves` int NOT NULL DEFAULT 0,
	`shares` int NOT NULL DEFAULT 0,
	`linkClicks` int NOT NULL DEFAULT 0,
	`leads` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`kind` enum('post','reel') NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`structure` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studio_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`activeSegmentId` varchar(8) NOT NULL DEFAULT 'S3',
	`strategyGoal` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studio_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `studio_settings_owner_unique` UNIQUE(`ownerId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `voice_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`tone` text NOT NULL,
	`address` varchar(40) NOT NULL,
	`energy` text NOT NULL,
	`structure` text NOT NULL,
	`proof` text NOT NULL,
	`cta` text NOT NULL,
	`avoid` text NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `voice_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `voice_profiles_owner_unique` UNIQUE(`ownerId`)
);
