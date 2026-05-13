CREATE TABLE `card_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cardName` varchar(100) NOT NULL DEFAULT 'Porto Seguro',
	`closingDay` int NOT NULL DEFAULT 26,
	`dueDay` int NOT NULL DEFAULT 1,
	`limit` decimal(10,2) NOT NULL DEFAULT '5000.00',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `card_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `card_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `credit_card_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` date NOT NULL,
	`description` varchar(255) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`category` varchar(100) NOT NULL,
	`installments` int NOT NULL DEFAULT 1,
	`installmentNumber` int NOT NULL DEFAULT 1,
	`billCycle` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_card_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `income` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` date NOT NULL,
	`description` varchar(255) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`source` varchar(100) NOT NULL DEFAULT 'comissão',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `income_id` PRIMARY KEY(`id`)
);
