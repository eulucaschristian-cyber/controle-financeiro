CREATE TABLE `custom_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`key` varchar(100) NOT NULL,
	`label` varchar(100) NOT NULL,
	`emoji` varchar(10) NOT NULL DEFAULT '📦',
	`color` varchar(100) NOT NULL DEFAULT 'bg-gray-100 text-gray-700',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `transactions` MODIFY COLUMN `category` varchar(100) NOT NULL;