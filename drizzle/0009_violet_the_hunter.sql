CREATE TABLE `invoice_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`billCycle` varchar(20) NOT NULL,
	`paidAt` date NOT NULL,
	`paidAmount` decimal(10,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoice_payments_id` PRIMARY KEY(`id`)
);
